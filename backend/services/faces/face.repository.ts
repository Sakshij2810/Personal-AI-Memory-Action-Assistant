// backend/services/faces/face.repository.ts

import pool from "../../config/db.js";
import {
  DetectedFaceInput,
  FaceCandidateGroup,
  FaceGroupingResult,
  FacePair,
  FaceRecord,
  FaceSimilaritySearchResult,
  SimilarFace,
} from "./types.js";

export const markFaceProcessingStarted = async (mediaId: string) => {
  await pool.query(
    `
    UPDATE media_files
    SET
      face_processing_status = 'processing',
      face_processing_started_at = NOW(),
      face_processing_attempt_count =
        face_processing_attempt_count + 1,
      face_processing_error = NULL,
      updated_at = NOW()
    WHERE id = $1
    `,
    [mediaId],
  );
};

export const saveDetectedFaces = async (
  mediaId: string,
  userId: string,
  faces: DetectedFaceInput[],
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const mediaResult = await client.query(
      `
      SELECT id
      FROM media_files
      WHERE id = $1 AND user_id = $2
      FOR UPDATE
      `,
      [mediaId, userId],
    );

    if (mediaResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return false;
    }

    await client.query(
      `
      DELETE FROM detected_faces
      WHERE media_file_id = $1
      `,
      [mediaId],
    );

    for (const face of faces) {
      const vectorValue = `[${face.embedding.join(",")}]`;

      await client.query(
        `
          INSERT INTO detected_faces (
            media_file_id,
            face_number,
            bounding_box,
            detection_confidence,
            embedding,
            crop_key
          )
          VALUES ($1, $2, $3::jsonb, $4, $5::vector, $6)
          `,
        [
          mediaId,
          face.faceNumber,
          JSON.stringify(face.boundingBox),
          face.detectionConfidence,
          vectorValue,
          face.cropKey,
        ],
      );
    }

    await client.query(
      `
      UPDATE media_files
      SET
        face_processing_status = 'completed',
        face_processing_started_at = NULL,
        face_processing_error = NULL,
        updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      `,
      [mediaId, userId],
    );

    await client.query("COMMIT");

    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

export const markFaceProcessingFailed = async (
  mediaId: string,
  errorMessage: string,
) => {
  await pool.query(
    `
    UPDATE media_files
    SET
      face_processing_status = 'failed',
      face_processing_started_at = NULL,
      face_processing_error = $2,
      updated_at = NOW()
    WHERE id = $1
    `,
    [mediaId, errorMessage.slice(0, 5000)],
  );
};

/**
 * Finds the most similar faces belonging to the authenticated user.
 *
 * Uses pgvector cosine distance:
 * similarity = 1 - cosine distance
 *
 * Faces from the anchor image are excluded.
 */
export const findSimilarFaces = async (
  faceId: string,
  userId: string,
  limit = 10,
  minSimilarity = 0.45,
): Promise<FaceSimilaritySearchResult | null> => {
  const result = await pool.query(
    `
    WITH anchor AS MATERIALIZED (
      SELECT
        df.id,
        df.media_file_id,
        df.embedding
      FROM detected_faces df
      INNER JOIN media_files mf
        ON mf.id = df.media_file_id
      WHERE df.id = $1
        AND mf.user_id = $2
    ),
    matches AS (
      SELECT
        df.id AS face_id,
        df.media_file_id,
        mf.filename,
        mf.thumbnail_key,
        df.face_number,
        df.bounding_box,
        df.detection_confidence,
        1 - (df.embedding <=> anchor.embedding) AS similarity
      FROM anchor
      CROSS JOIN detected_faces df
      INNER JOIN media_files mf
        ON mf.id = df.media_file_id
      WHERE mf.user_id = $2
        AND df.id <> anchor.id
        AND df.media_file_id <> anchor.media_file_id
        AND 1 - (df.embedding <=> anchor.embedding) >= $3
      ORDER BY df.embedding <=> anchor.embedding ASC
      LIMIT $4
    )
    SELECT
      (SELECT id FROM anchor) AS anchor_face_id,
      matches.*
    FROM (SELECT 1) AS seed
    LEFT JOIN matches ON TRUE
    `,
    [faceId, userId, minSimilarity, limit],
  );

  if (!result.rows[0]?.anchor_face_id) {
    return null;
  }

  const matches: SimilarFace[] = result.rows
    .filter((row) => row.face_id !== null)
    .map((row) => ({
      faceId: row.face_id,
      mediaFileId: row.media_file_id,
      filename: row.filename,
      thumbnailKey: row.thumbnail_key,
      faceNumber: row.face_number,
      boundingBox: row.bounding_box,
      detectionConfidence: Number(row.detection_confidence),
      similarity: Number(row.similarity),
    }));

  return {
    anchorFaceId: result.rows[0].anchor_face_id,
    matches,
  };
};

/**
 * Builds conservative candidate groups across a user's photos.
 *
 * Strategy:
 * 1. Find all cross-photo face pairs above the threshold.
 * 2. Process strongest similarity pairs first.
 * 3. Merge groups only when they:
 *    - Do not share a source photo.
 *    - Satisfy the complete-link similarity threshold.
 *
 * This is an on-demand grouping operation. It does not persist identities
 * or modify detected_faces.
 */
export const findFaceGroups = async (
  userId: string,
  minSimilarity = 0.45,
): Promise<FaceGroupingResult> => {
  const facesResult = await pool.query(
    `
  SELECT
    df.id AS face_id,
    df.media_file_id,
    mf.filename,
    mf.thumbnail_key,
    df.face_number,
    df.bounding_box,
    df.detection_confidence
  FROM detected_faces df
  INNER JOIN media_files mf
    ON mf.id = df.media_file_id
  WHERE mf.user_id = $1
    AND mf.face_processing_status = 'completed'
    AND NOT EXISTS (
      SELECT 1
      FROM person_faces pf
      WHERE pf.face_id = df.id
    )
  ORDER BY mf.uploaded_at ASC, df.face_number ASC
  `,
    [userId],
  );

  const faces: FaceRecord[] = facesResult.rows.map((row) => ({
    faceId: row.face_id,
    mediaFileId: row.media_file_id,
    filename: row.filename,
    thumbnailKey: row.thumbnail_key,
    faceNumber: row.face_number,
    boundingBox: row.bounding_box,
    detectionConfidence: Number(row.detection_confidence),
  }));

  const totalFaces = faces.length;

  if (totalFaces < 2) {
    return {
      threshold: minSimilarity,
      totalFaces,
      groupedFaces: 0,
      ungroupedFaces: totalFaces,
      groupCount: 0,
      groups: [],
    };
  }

  // Prevent unexpectedly expensive all-pairs comparisons.
  if (totalFaces > 2000) {
    throw new Error(
      "Face grouping currently supports up to 2000 detected faces per user.",
    );
  }

  const pairsResult = await pool.query(
    `
  SELECT
    face_a.id AS face_id_1,
    face_b.id AS face_id_2,
    1 - (face_a.embedding <=> face_b.embedding) AS similarity
  FROM detected_faces face_a
  INNER JOIN media_files media_a
    ON media_a.id = face_a.media_file_id
  INNER JOIN detected_faces face_b
    ON face_a.id < face_b.id
    AND face_a.media_file_id <> face_b.media_file_id
  INNER JOIN media_files media_b
    ON media_b.id = face_b.media_file_id
  WHERE media_a.user_id = $1
    AND media_b.user_id = $1
    AND media_a.face_processing_status = 'completed'
    AND media_b.face_processing_status = 'completed'
    AND NOT EXISTS (
      SELECT 1
      FROM person_faces pf
      WHERE pf.face_id = face_a.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM person_faces pf
      WHERE pf.face_id = face_b.id
    )
    AND 1 - (face_a.embedding <=> face_b.embedding) >= $2
  ORDER BY similarity DESC, face_a.id ASC, face_b.id ASC
  `,
    [userId, minSimilarity],
  );

  const pairs: FacePair[] = pairsResult.rows.map((row) => ({
    faceId1: row.face_id_1,
    faceId2: row.face_id_2,
    similarity: Number(row.similarity),
  }));

  // Disjoint-set structure with source-photo tracking.
  const parent = new Map<string, string>();
  const componentSize = new Map<string, number>();
  const componentMedia = new Map<string, Set<string>>();
  const componentFaces = new Map<string, Set<string>>();

  for (const face of faces) {
    parent.set(face.faceId, face.faceId);
    componentSize.set(face.faceId, 1);
    componentMedia.set(face.faceId, new Set([face.mediaFileId]));
    componentFaces.set(face.faceId, new Set([face.faceId]));
  }

  const findRoot = (faceId: string): string => {
    const currentParent = parent.get(faceId);

    if (!currentParent || currentParent === faceId) {
      return faceId;
    }

    const root = findRoot(currentParent);
    parent.set(faceId, root);
    return root;
  };

  const pairKey = (id1: string, id2: string) =>
    id1 < id2 ? `${id1}:${id2}` : `${id2}:${id1}`;

  const pairSimilarity = new Map<string, number>();

  for (const pair of pairs) {
    pairSimilarity.set(pairKey(pair.faceId1, pair.faceId2), pair.similarity);
  }

  // Strongest matches are considered first.
  for (const pair of pairs) {
    const rootA = findRoot(pair.faceId1);
    const rootB = findRoot(pair.faceId2);

    if (rootA === rootB) {
      continue;
    }

    const mediaA = componentMedia.get(rootA)!;
    const mediaB = componentMedia.get(rootB)!;

    // A candidate group cannot contain two faces from the same photo.
    const hasDuplicatePhoto = [...mediaA].some((mediaId) =>
      mediaB.has(mediaId),
    );

    if (hasDuplicatePhoto) {
      continue;
    }

    const facesA = componentFaces.get(rootA)!;
    const facesB = componentFaces.get(rootB)!;

    // Complete-link safeguard:
    // every cross-group face pair must satisfy the threshold.
    let allCrossPairsMatch = true;

    for (const faceA of facesA) {
      for (const faceB of facesB) {
        const similarity = pairSimilarity.get(pairKey(faceA, faceB));

        if (similarity === undefined || similarity < minSimilarity) {
          allCrossPairsMatch = false;
          break;
        }
      }

      if (!allCrossPairsMatch) {
        break;
      }
    }

    if (!allCrossPairsMatch) {
      continue;
    }

    // Union by component size.
    const sizeA = componentSize.get(rootA) ?? 1;
    const sizeB = componentSize.get(rootB) ?? 1;

    const newRoot = sizeA >= sizeB ? rootA : rootB;
    const oldRoot = sizeA >= sizeB ? rootB : rootA;

    parent.set(oldRoot, newRoot);

    componentSize.set(newRoot, sizeA + sizeB);

    componentMedia.set(newRoot, new Set([...mediaA, ...mediaB]));

    componentFaces.set(newRoot, new Set([...facesA, ...facesB]));

    componentSize.delete(oldRoot);
    componentMedia.delete(oldRoot);
    componentFaces.delete(oldRoot);
  }

  const membersByRoot = new Map<string, FaceRecord[]>();

  for (const face of faces) {
    const root = findRoot(face.faceId);
    const members = membersByRoot.get(root) ?? [];

    members.push(face);
    membersByRoot.set(root, members);
  }

  const similarityByFace = new Map<string, number>();

  for (const pair of pairs) {
    const rootA = findRoot(pair.faceId1);
    const rootB = findRoot(pair.faceId2);

    if (rootA !== rootB) {
      continue;
    }

    similarityByFace.set(
      pair.faceId1,
      Math.max(similarityByFace.get(pair.faceId1) ?? 0, pair.similarity),
    );

    similarityByFace.set(
      pair.faceId2,
      Math.max(similarityByFace.get(pair.faceId2) ?? 0, pair.similarity),
    );
  }

  const candidateGroups: FaceCandidateGroup[] = [];

  for (const members of membersByRoot.values()) {
    if (members.length < 2) {
      continue;
    }

    const sortedMembers = [...members].sort((a, b) => {
      return (
        a.filename.localeCompare(b.filename) || a.faceNumber - b.faceNumber
      );
    });

    candidateGroups.push({
      groupId: "",
      faceCount: sortedMembers.length,
      photoCount: new Set(sortedMembers.map((member) => member.mediaFileId))
        .size,
      members: sortedMembers.map((member) => ({
        faceId: member.faceId,
        mediaFileId: member.mediaFileId,
        filename: member.filename,
        thumbnailKey: member.thumbnailKey,
        cropUrl: `/api/v1/faces/${member.faceId}/image`,
        faceNumber: member.faceNumber,
        boundingBox: member.boundingBox,
        detectionConfidence: member.detectionConfidence,
        maxSimilarityToGroup: similarityByFace.get(member.faceId) ?? 0,
      })),
    });
  }

  // Stable ordering for easier testing and UI rendering.
  candidateGroups.sort((a, b) => {
    const firstA = a.members[0]?.faceId ?? "";
    const firstB = b.members[0]?.faceId ?? "";
    return firstA.localeCompare(firstB);
  });

  candidateGroups.forEach((group, index) => {
    group.groupId = `candidate-${index + 1}`;
  });

  const groupedFaces = candidateGroups.reduce(
    (total, group) => total + group.faceCount,
    0,
  );

  return {
    threshold: minSimilarity,
    totalFaces,
    groupedFaces,
    ungroupedFaces: totalFaces - groupedFaces,
    groupCount: candidateGroups.length,
    groups: candidateGroups,
  };
};

// Persists face crop keys and exposes crop URLs in candidate-group results.
export const findFaceCropForUser = async (
  faceId: string,
  userId: string,
): Promise<string | null> => {
  const result = await pool.query(
    `
    SELECT df.crop_key
    FROM detected_faces df
    INNER JOIN media_files mf
      ON mf.id = df.media_file_id
    WHERE df.id = $1
      AND mf.user_id = $2
    LIMIT 1
    `,
    [faceId, userId],
  );

  return result.rows[0]?.crop_key ?? null;
};
