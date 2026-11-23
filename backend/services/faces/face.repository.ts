import pool from "../../config/db.js";

export interface FaceBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedFaceInput {
  faceNumber: number;
  boundingBox: FaceBoundingBox;
  detectionConfidence: number;
  embedding: number[];
}

/**
 * Marks face processing as started.
 * Increments the attempt counter for each worker attempt.
 */
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

/**
 * Replaces all detected faces for a media file.
 *
 * This operation is transactional and idempotent:
 * running it again replaces the previous face records.
 */
export const saveDetectedFaces = async (
  mediaId: string,
  userId: string,
  faces: DetectedFaceInput[],
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock and verify ownership of the original media.
    const mediaResult = await client.query(
      `
      SELECT id
      FROM media_files
      WHERE id = $1 AND user_id = $2
      FOR UPDATE
      `,
      [mediaId, userId],
    );

    // Media may have been deleted while the job was running.
    if (mediaResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return false;
    }

    // Remove previous results before inserting fresh results.
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
          embedding
        )
        VALUES ($1, $2, $3::jsonb, $4, $5::vector)
        `,
        [
          mediaId,
          face.faceNumber,
          JSON.stringify(face.boundingBox),
          face.detectionConfidence,
          vectorValue,
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

/**
 * Marks face processing as failed after all retries are exhausted.
 */
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
