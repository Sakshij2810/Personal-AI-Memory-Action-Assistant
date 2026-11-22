// backend/helper/media.helper.ts

import pool from "../config/db.js";
import { UploadedImage } from "../types/types.js";

// -------------------------------------------------------------------------- Helpers --------------------------------------------------------------------------

// save Image Meta data into DB - "Atomicity"
export const saveImageMetadata = async (
  userId: string,
  files: UploadedImage[],
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const uploadedImages = [];

    for (const file of files) {
      const result = await client.query(
        `
        INSERT INTO media_files (
          user_id,
          filename,
          storage_key,
          mime_type,
          file_size,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          userId,
          file.originalname,
          file.filename,
          file.mimetype,
          file.size,
          "uploaded",
        ],
      );

      uploadedImages.push(result.rows[0]);
    }

    await client.query("COMMIT");

    return uploadedImages;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
