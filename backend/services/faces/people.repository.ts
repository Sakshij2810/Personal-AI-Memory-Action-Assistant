// backend/services/faces/people.repository.ts
import type { PoolClient } from "pg";
import pool from "../../config/db.js";
import {
  ConfirmedPerson,
  ConfirmPersonInput,
  PersonGallery,
  PersonSummary,
  SplitPersonInput,
} from "./types.js";

// --------------------------------- Shared Helpers ---------------------------------

const normalizePersonName = (name: string): string => {
  const normalizedName = name.trim();

  if (!normalizedName) {
    throw Object.assign(new Error("Person name cannot be empty."), {
      code: "INVALID_PERSON_NAME",
    });
  }

  return normalizedName;
};

const handleRepositoryError = (error: unknown): never => {
  const pgError = error as {
    code?: string;
    constraint?: string;
  };

  if (
    pgError.code === "23505" &&
    pgError.constraint === "idx_people_user_unique_normalized_name"
  ) {
    throw Object.assign(new Error("A person with this name already exists."), {
      code: "PERSON_NAME_ALREADY_EXISTS",
    });
  }

  throw error;
};

// Lock people in a consistent order to reduce deadlock risk.
const lockPeopleForUser = async (
  client: PoolClient,
  personIds: string[],
  userId: string,
): Promise<string[]> => {
  const uniqueIds = [...new Set(personIds)];

  const result = await client.query<{ id: string }>(
    `
    SELECT id
    FROM people
    WHERE id = ANY($1::uuid[])
      AND user_id = $2
    ORDER BY id
    FOR UPDATE
    `,
    [uniqueIds, userId],
  );

  return result.rows.map((row) => row.id);
};

// --------------------------------- Confirm Person Identity ---------------------------------

export const confirmPersonIdentity = async ({
  userId,
  name,
  faceIds,
}: ConfirmPersonInput): Promise<ConfirmedPerson> => {
  const normalizedName = normalizePersonName(name);

  if (faceIds.length === 0) {
    throw Object.assign(new Error("At least one face must be selected."), {
      code: "NO_FACES_SELECTED",
    });
  }

  if (new Set(faceIds).size !== faceIds.length) {
    throw Object.assign(new Error("Duplicate face IDs are not allowed."), {
      code: "DUPLICATE_FACE_IDS",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const facesResult = await client.query(
      `
      SELECT df.id
      FROM detected_faces df
      INNER JOIN media_files mf ON mf.id = df.media_file_id
      WHERE df.id = ANY($1::uuid[])
        AND mf.user_id = $2
        AND mf.face_processing_status = 'completed'
      ORDER BY df.id
      FOR UPDATE OF df
      `,
      [faceIds, userId],
    );

    if ((facesResult.rowCount ?? 0) !== faceIds.length) {
      throw Object.assign(new Error("Faces not found."), {
        code: "FACES_NOT_FOUND",
      });
    }

    const assignedResult = await client.query(
      `
      SELECT pf.face_id
      FROM person_faces pf
      INNER JOIN people p ON p.id = pf.person_id
      WHERE pf.face_id = ANY($1::uuid[])
        AND p.user_id = $2
      `,
      [faceIds, userId],
    );

    if ((assignedResult.rowCount ?? 0) > 0) {
      throw Object.assign(new Error("Faces already assigned."), {
        code: "FACES_ALREADY_ASSIGNED",
      });
    }

    const personResult = await client.query(
      `
      INSERT INTO people (user_id, name)
      VALUES ($1, $2)
      RETURNING id, name, created_at
      `,
      [userId, normalizedName],
    );

    const person = personResult.rows[0];

    await client.query(
      `
      INSERT INTO person_faces (person_id, face_id)
      SELECT $1, selected_face_id
      FROM unnest($2::uuid[]) AS selected_face_id
      `,
      [person.id, faceIds],
    );

    await client.query("COMMIT");

    return {
      id: person.id,
      name: person.name,
      createdAt: person.created_at,
      faceCount: faceIds.length,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    return handleRepositoryError(error);
  } finally {
    client.release();
  }
};

// --------------------------------- Get People ---------------------------------

export const getPeopleForUser = async (
  userId: string,
): Promise<{ count: number; people: PersonSummary[] }> => {
  const result = await pool.query(
    `
    SELECT
      p.id,
      p.name,
      p.created_at,
      COUNT(DISTINCT pf.face_id)::int AS face_count,
      COUNT(DISTINCT df.media_file_id)::int AS photo_count,
      (
        ARRAY_AGG(df.id ORDER BY pf.created_at ASC)
        FILTER (WHERE df.id IS NOT NULL)
      )[1] AS representative_face_id
    FROM people p
    LEFT JOIN person_faces pf ON pf.person_id = p.id
    LEFT JOIN detected_faces df ON df.id = pf.face_id
    LEFT JOIN media_files mf ON mf.id = df.media_file_id
    WHERE p.user_id = $1
    GROUP BY p.id, p.name, p.created_at
    HAVING COUNT(pf.face_id) > 0
    ORDER BY p.created_at DESC
    `,
    [userId],
  );

  const people: PersonSummary[] = result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    faceCount: row.face_count,
    photoCount: row.photo_count,
    representativeFaceId: row.representative_face_id,
    createdAt: row.created_at,
  }));

  return {
    count: people.length,
    people,
  };
};

// --------------------------------- Person Gallery ---------------------------------

export const getPersonGalleryForUser = async (
  personId: string,
  userId: string,
): Promise<PersonGallery | null> => {
  const personResult = await pool.query(
    `
    SELECT
      p.id,
      p.name,
      p.created_at,
      COUNT(DISTINCT pf.face_id)::int AS face_count,
      COUNT(DISTINCT df.media_file_id)::int AS photo_count
    FROM people p
    LEFT JOIN person_faces pf ON pf.person_id = p.id
    LEFT JOIN detected_faces df ON df.id = pf.face_id
    LEFT JOIN media_files mf ON mf.id = df.media_file_id
    WHERE p.id = $1
      AND p.user_id = $2
    GROUP BY p.id, p.name, p.created_at
    `,
    [personId, userId],
  );

  if ((personResult.rowCount ?? 0) === 0) {
    return null;
  }

  const person = personResult.rows[0];

  const facesResult = await pool.query(
    `
    SELECT
      df.id AS face_id,
      df.face_number,
      df.crop_key,
      mf.id AS media_file_id,
      mf.filename,
      mf.uploaded_at AS uploaded_at
    FROM person_faces pf
    INNER JOIN people p ON p.id = pf.person_id
    INNER JOIN detected_faces df ON df.id = pf.face_id
    INNER JOIN media_files mf ON mf.id = df.media_file_id
    WHERE p.id = $1
      AND p.user_id = $2
      AND mf.user_id = $2
      AND mf.face_processing_status = 'completed'
    ORDER BY mf.uploaded_at DESC, df.face_number ASC
    `,
    [personId, userId],
  );

  return {
    person: {
      id: person.id,
      name: person.name,
      faceCount: person.face_count,
      photoCount: person.photo_count,
      createdAt: person.created_at,
    },
    faces: facesResult.rows.map((row) => ({
      faceId: row.face_id,
      mediaFileId: row.media_file_id,
      filename: row.filename,
      faceNumber: row.face_number,
      cropUrl: `/api/v1/faces/${row.face_id}/image`,
      uploadedAt: row.uploaded_at,
    })),
  };
};

// --------------------------------- Assign / Move Face ---------------------------------

export const assignFaceToPersonForUser = async (
  personId: string,
  faceId: string,
  userId: string,
): Promise<"assigned" | "already_assigned" | null> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Find the current assignment before acquiring locks.
    const currentAssignmentResult = await client.query(
      `
      SELECT pf.person_id
      FROM person_faces pf
      INNER JOIN people p ON p.id = pf.person_id
      WHERE pf.face_id = $1
        AND p.user_id = $2
      `,
      [faceId, userId],
    );

    const currentPersonId = currentAssignmentResult.rows[0]?.person_id as
      | string
      | undefined;

    // Lock target and current person in consistent order.
    const personIds = currentPersonId
      ? [personId, currentPersonId]
      : [personId];

    const lockedPersonIds = await lockPeopleForUser(client, personIds, userId);

    if (!lockedPersonIds.includes(personId)) {
      await client.query("ROLLBACK");
      return null;
    }

    // Lock and verify the face after locking its people.
    const faceResult = await client.query(
      `
      SELECT df.id
      FROM detected_faces df
      INNER JOIN media_files mf ON mf.id = df.media_file_id
      WHERE df.id = $1
        AND mf.user_id = $2
        AND mf.face_processing_status = 'completed'
      FOR UPDATE OF df
      `,
      [faceId, userId],
    );

    if ((faceResult.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    // Recheck assignment after acquiring locks.
    const assignmentResult = await client.query(
      `
      SELECT pf.person_id
      FROM person_faces pf
      WHERE pf.face_id = $1
      FOR UPDATE
      `,
      [faceId],
    );

    if ((assignmentResult.rowCount ?? 0) > 0) {
      const actualPersonId = assignmentResult.rows[0].person_id;

      if (actualPersonId === personId) {
        await client.query("COMMIT");
        return "already_assigned";
      }

      // If another operation changed the assignment while we
      // were acquiring locks, don't modify an unlocked person.
      if (!lockedPersonIds.includes(actualPersonId)) {
        throw Object.assign(
          new Error("Face assignment changed. Please retry."),
          { code: "FACE_ASSIGNMENT_CHANGED" },
        );
      }

      await client.query(
        `
        UPDATE person_faces
        SET person_id = $1
        WHERE face_id = $2
        `,
        [personId, faceId],
      );

      // The database trigger automatically deletes the old
      // person if this was their last assigned face.
    } else {
      await client.query(
        `
        INSERT INTO person_faces (person_id, face_id)
        VALUES ($1, $2)
        `,
        [personId, faceId],
      );
    }

    await client.query(
      `
      UPDATE people
      SET updated_at = NOW()
      WHERE id = $1
        AND user_id = $2
      `,
      [personId, userId],
    );

    await client.query("COMMIT");
    return "assigned";
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    return handleRepositoryError(error);
  } finally {
    client.release();
  }
};

// --------------------------------- Remove Face Assignment ---------------------------------

export const removeFaceFromPersonForUser = async (
  personId: string,
  faceId: string,
  userId: string,
): Promise<boolean> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the person first, matching the lock order used
    // by move and split operations.
    const lockedPersonIds = await lockPeopleForUser(client, [personId], userId);

    if (!lockedPersonIds.includes(personId)) {
      await client.query("ROLLBACK");
      return false;
    }

    const faceResult = await client.query(
      `
      SELECT df.id
      FROM detected_faces df
      INNER JOIN media_files mf ON mf.id = df.media_file_id
      WHERE df.id = $1
        AND mf.user_id = $2
      FOR UPDATE OF df
      `,
      [faceId, userId],
    );

    if ((faceResult.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return false;
    }

    const deleteResult = await client.query(
      `
      DELETE FROM person_faces pf
      WHERE pf.person_id = $1
        AND pf.face_id = $2
      RETURNING pf.id
      `,
      [personId, faceId],
    );

    // The database trigger deletes the person if this was
    // their final face assignment.

    await client.query("COMMIT");

    return (deleteResult.rowCount ?? 0) > 0;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

// --------------------------------- Merge People ---------------------------------

export const mergePeopleForUser = async (
  targetPersonId: string,
  sourcePersonId: string,
  userId: string,
): Promise<{
  id: string;
  mergedPersonId: string;
  movedFaceCount: number;
} | null> => {
  if (targetPersonId === sourcePersonId) {
    throw Object.assign(new Error("Cannot merge a person into itself."), {
      code: "SAME_PERSON",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lockedPersonIds = await lockPeopleForUser(
      client,
      [targetPersonId, sourcePersonId],
      userId,
    );

    if (
      lockedPersonIds.length !== 2 ||
      !lockedPersonIds.includes(targetPersonId) ||
      !lockedPersonIds.includes(sourcePersonId)
    ) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      `
      UPDATE people
      SET updated_at = NOW()
      WHERE id = $1
        AND user_id = $2
      `,
      [targetPersonId, userId],
    );

    const moveResult = await client.query(
      `
      UPDATE person_faces
      SET person_id = $1
      WHERE person_id = $2
      RETURNING id
      `,
      [targetPersonId, sourcePersonId],
    );

    // The cleanup trigger normally deletes the source person
    // after its final face is transferred.
    // This explicit deletion also handles an already-empty source
    // record safely and is harmless if the trigger deleted it.
    await client.query(
      `
      DELETE FROM people
      WHERE id = $1
        AND user_id = $2
        AND NOT EXISTS (
          SELECT 1
          FROM person_faces pf
          WHERE pf.person_id = people.id
        )
      `,
      [sourcePersonId, userId],
    );

    await client.query("COMMIT");

    return {
      id: targetPersonId,
      mergedPersonId: sourcePersonId,
      movedFaceCount: moveResult.rowCount ?? 0,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

// --------------------------------- Split Person ---------------------------------

export const splitPersonForUser = async ({
  userId,
  sourcePersonId,
  newPersonName,
  faceIds,
}: SplitPersonInput): Promise<ConfirmedPerson | null> => {
  const normalizedName = normalizePersonName(newPersonName);

  if (faceIds.length === 0) {
    throw Object.assign(new Error("At least one face must be selected."), {
      code: "NO_FACES_SELECTED",
    });
  }

  if (new Set(faceIds).size !== faceIds.length) {
    throw Object.assign(new Error("Duplicate face IDs are not allowed."), {
      code: "DUPLICATE_FACE_IDS",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lockedPersonIds = await lockPeopleForUser(
      client,
      [sourcePersonId],
      userId,
    );

    if (!lockedPersonIds.includes(sourcePersonId)) {
      await client.query("ROLLBACK");
      return null;
    }

    // Verify every selected face is assigned to the source person
    // and belongs to this user.
    const facesResult = await client.query(
      `
      SELECT pf.face_id
      FROM person_faces pf
      INNER JOIN detected_faces df ON df.id = pf.face_id
      INNER JOIN media_files mf ON mf.id = df.media_file_id
      WHERE pf.person_id = $1
        AND pf.face_id = ANY($2::uuid[])
        AND mf.user_id = $3
        AND mf.face_processing_status = 'completed'
      ORDER BY pf.face_id
      FOR UPDATE OF pf, df
      `,
      [sourcePersonId, faceIds, userId],
    );

    if ((facesResult.rowCount ?? 0) !== faceIds.length) {
      throw Object.assign(
        new Error("One or more selected faces do not belong to this person."),
        { code: "SPLIT_FACES_NOT_FOUND" },
      );
    }

    // Update source timestamp before moving faces because the
    // cleanup trigger may delete the source during the transfer.
    await client.query(
      `
      UPDATE people
      SET updated_at = NOW()
      WHERE id = $1
        AND user_id = $2
      `,
      [sourcePersonId, userId],
    );

    const newPersonResult = await client.query(
      `
      INSERT INTO people (user_id, name)
      VALUES ($1, $2)
      RETURNING id, name, created_at
      `,
      [userId, normalizedName],
    );

    const newPerson = newPersonResult.rows[0];

    const moveResult = await client.query(
      `
      UPDATE person_faces
      SET person_id = $1
      WHERE person_id = $2
        AND face_id = ANY($3::uuid[])
      RETURNING face_id
      `,
      [newPerson.id, sourcePersonId, faceIds],
    );

    if ((moveResult.rowCount ?? 0) !== faceIds.length) {
      throw new Error("Failed to move all selected faces.");
    }

    // If all faces were moved, the database trigger removes
    // the now-empty source person automatically.

    await client.query("COMMIT");

    return {
      id: newPerson.id,
      name: newPerson.name,
      createdAt: newPerson.created_at,
      faceCount: faceIds.length,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    return handleRepositoryError(error);
  } finally {
    client.release();
  }
};
