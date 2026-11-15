import type { Request, Response } from "express";
import fs from "node:fs/promises";

import { UploadedImage } from "../types/types.js";
import pool from "../config/db.js";
import path from "node:path";

// save Image Meta data into DB
const saveImageMetadata = async (userId: string, files: UploadedImage[]) => {
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

// Single image upload
export const uploadSingleImage = async (req: Request, res: Response) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      success: false,
      message: "Please select an image to upload.",
    });
  }

  try {
    const images = await saveImageMetadata(req.user!.id, [file]);

    return res.status(201).json({
      success: true,
      message: "Image uploaded successfully.",
      image: images[0],
    });
  } catch (error: unknown) {
    // Remove the physical file if the database operation fails.
    await fs.unlink(file.path).catch(() => undefined);

    console.error("Single image upload error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save image metadata.",
    });
  }
};

// Multiple image upload
export const uploadMultipleImages = async (req: Request, res: Response) => {
  const files = Array.isArray(req.files) ? req.files : [];

  if (files.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Please select at least one image to upload.",
    });
  }
  try {
    const images = await saveImageMetadata(req.user!.id, files);

    return res.status(201).json({
      success: true,
      message: `${images.length} images uploaded successfully.`,
      count: images.length,
      images,
    });
  } catch (error: unknown) {
    // Remove all physical files if the database operation fails.
    await Promise.all(
      files.map((file) => fs.unlink(file.path).catch(() => undefined)),
    );

    console.error("Multiple image upload error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save image metadata.",
    });
  }
};

// get User Images
export const getUserImages = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorised",
      });
    }

    const result = await pool.query(
      `
      SELECT id, filename, storage_key,mime_type, file_size, uploaded_at
      FROM media_files
      WHERE user_id = $1
         AND status = 'uploaded'
      ORDER BY uploaded_at DESC
      `,
      [userId],
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      images: result.rows,
    });
  } catch (error: unknown) {
    console.error("Get user images error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch images.",
    });
  }
};

// get Image File
export const getImageFile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const imageId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorised",
      });
    }

    const result = await pool.query(
      `
      SELECT storage_key, mime_type
      FROM media_files
      WHERE id = $1 AND user_id = $2
      `,
      [imageId, userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Image not found.",
      });
    }

    const { storage_key, mime_type } = result.rows[0];

    const storageDirectory = path.resolve(
      process.cwd(),
      "UploadMediaLocalStorage",
    );

    const imagePath = path.resolve(storageDirectory, storage_key);

    // Prevent paths from escaping the storage directory.
    if (!imagePath.startsWith(storageDirectory + path.sep)) {
      return res.status(400).json({
        success: false,
        message: "Invalid image path.",
      });
    }

    res.type(mime_type);

    return res.sendFile(imagePath, (error) => {
      if (error && !res.headersSent) {
        console.error("Image serving error:", error);

        res.status(404).json({
          success: false,
          message: "Image file not found.",
        });
      }
    });
  } catch (error: unknown) {
    console.error("Get image file error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve image.",
    });
  }
};
