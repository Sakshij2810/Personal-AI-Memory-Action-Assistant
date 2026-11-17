import { type Request, type Response } from "express";
import fs from "node:fs/promises";

import { UploadedImage } from "../types/types.js";
import pool from "../config/db.js";
import path from "node:path";
import mediaProcessingQueue from "../queues/media.queue.js";

// -------------------------------------------------------------------------- Helpers --------------------------------------------------------------------------

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

// Create Jobs for each image : Add uploaded images to the BullMQ processing queue. enqueueMediaProcessingJobs
const enqueueMediaProcessingJobs = async (
  images: {
    id: string;
    user_id: string;
    storage_key: string;
  }[],
) => {
  const jobs = images.map((image) => ({
    name: "process-image",
    data: {
      mediaId: image.id,
      userId: image.user_id,
      storageKey: image.storage_key,
    },
  }));

  return await mediaProcessingQueue.addBulk(jobs);
};

// -------------------------------------------------------------------------- Controllers --------------------------------------------------------------------------

// Single image upload
export const uploadSingleImage = async (req: Request, res: Response) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      success: false,
      message: "Please select an image to upload.",
    });
  }

  let images;

  // 1. Save image metadata in PostgreSQL.
  try {
    images = await saveImageMetadata(req.user!.id, [file]);
  } catch (error: unknown) {
    // Only remove the physical file if database saving fails.
    await fs.unlink(file.path).catch(() => undefined);

    console.error("Single image upload error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save image metadata.",
    });
  }

  // 2. Add the image to BullMQ.
  try {
    await enqueueMediaProcessingJobs(images);

    return res.status(201).json({
      success: true,
      message: "Image uploaded and queued for processing.",
      processingQueued: true,
      image: images[0],
    });
  } catch (error: unknown) {
    console.error("Failed to enqueue image processing job:", error);

    // Image and database record are already saved.
    // Do not delete the original file.

    return res.status(201).json({
      success: true,
      message: "Image uploaded, but processing could not be queued.",
      processingQueued: false,
      image: images[0],
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

  let images;

  // 1. Save all image metadata in PostgreSQL.
  try {
    images = await saveImageMetadata(req.user!.id, files);
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

  // 2. Add one processing job per image.
  try {
    const jobs = await enqueueMediaProcessingJobs(images);

    return res.status(201).json({
      success: true,
      message: `${images.length} images uploaded and queued for processing.`,
      count: images.length,
      processingQueued: true,
      jobsQueued: jobs.length,
      images,
    });
  } catch (error: unknown) {
    console.error("Failed to enqueue image processing jobs:", error);

    // Database records and original files are already saved.
    // Do not delete them.

    return res.status(201).json({
      success: true,
      message: "Images uploaded, but processing could not be queued.",
      count: images.length,
      processingQueued: false,
      images,
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
      SELECT
        id,
        filename,
        storage_key,
        mime_type,
        file_size,
        uploaded_at,
        processing_status,
        thumbnail_key,
        width,
        height,
        format
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
/* Authenticate → Query database → Verify ownership → Resolve file path → Security check → Send image

1. Get the required information

- Get the authenticated user's ID from req.user.
- Get the image ID from the route parameter (req.params).

2. Validate authentication

- Check whether the user ID exists.
- If not, return HTTP 401 Unauthorized.

3. Fetch image information from PostgreSQL

- Query the media_files table.
- Select only storage_key and mime_type.
- Find the record using both:
  - Image ID
  - Authenticated user's ID
Hint: Use SQL parameterized queries with $1 and $2.

4. Check whether the image exists

- If the query returns zero rows, return HTTP 404 Not Found.

5. Extract image information

- Get storage_key and mime_type from the database result.

6. Construct the image's absolute path

- Get the local storage directory using process.cwd() and path.resolve().
- Construct the complete image path using the storage directory and storage_key.

7. Validate the image path (security check)

- Ensure the constructed image path stays inside the intended storage directory.
- If it attempts to escape that directory, return HTTP 400 Bad Request.

8. Set the response content type

- Tell Express which type of file it is sending using the MIME type retrieved from PostgreSQL.

9. Send the image file

- Use Express's file-sending method to return the image.
- Handle errors that occur while sending the file.
- If the response hasn't already been sent, return HTTP 404.

10. Handle unexpected errors

- Add a catch block.
- Log the error.
- Return HTTP 500 Internal Server Error.

 */

export const getImageFile = async (req: Request, res: Response) => {
  try {
    // 1. Get user's ID, image ID
    const userId = req.user?.id;
    const imageId = req.params.id;

    // 2. Validate authentication
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorised",
      });
    }

    // 3. Fetch image information from PostgreSQL
    const result = await pool.query(
      `
      SELECT storage_key, mime_type 
      FROM media_files
      WHERE id = $1 AND user_id = $2
      
      `,
      [imageId, userId],
    );

    // 4. Check whether the image exists
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Image not found.",
      });
    }

    // 5. Extract image information
    const { storage_key, mime_type } = result.rows[0];

    // 6. Construct the image's absolute path
    const storageDirectory = path.resolve(
      process.cwd(),
      "UploadMediaLocalStorage",
    );

    const imagePath = path.resolve(storageDirectory, storage_key);

    // 7. Validate the image path (security check)
    if (!imagePath.startsWith(storageDirectory + path.sep)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid image path." });
    }

    // 8. Set the response content type - Tell Express which type of file it is sending using the MIME type retrieved
    res.type(mime_type);

    // 9. Send the image file
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

// get Thumbnail ImageFile
export const getThumbnailImageFile = async (req: Request, res: Response) => {
  try {
    // 1. Authenticate the user.
    const userId = req.user?.id;
    const imageId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // 2. Find the image belonging to this user.
    const result = await pool.query(
      `
      SELECT thumbnail_key, processing_status
      FROM media_files
      WHERE id = $1 AND user_id = $2
      `,
      [imageId, userId],
    );

    // 3. Check whether the image exists.
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Image not found.",
      });
    }

    // 4. Check whether thumbnail processing is complete.
    const { thumbnail_key, processing_status } = result.rows[0];

    if (processing_status !== "completed" || !thumbnail_key) {
      return res.status(409).json({
        success: false,
        message: "Thumbnail is not ready yet.",
        processingStatus: processing_status,
      });
    }

    // 5. Construct absolute paths.
    const thumbnailDirectory = path.resolve(
      process.cwd(),
      "UploadMediaThumbnails",
    );

    const thumbnailPath = path.resolve(thumbnailDirectory, thumbnail_key);

    // 6. Prevent path traversal.
    if (!thumbnailPath.startsWith(thumbnailDirectory + path.sep)) {
      return res.status(400).json({
        success: false,
        message: "Invalid thumbnail path.",
      });
    }

    // 7. Set content type.
    res.type("image/webp");

    // 8. Send the thumbnail.
    return res.sendFile(thumbnailPath, (error) => {
      if (error && !res.headersSent) {
        console.error("Thumbnail serving error:", error);

        res.status(404).json({
          success: false,
          message: "Thumbnail file not found.",
        });
      }
    });
  } catch (error: unknown) {
    console.error("Get thumbnail error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve thumbnail.",
    });
  }
};

// Delete image from PostgreSQL and local storage

export const deleteImage = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const imageId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorised",
      });
    }

    // 1. Find the image and verify that it belongs to this user.
    const imageResult = await pool.query(
      `
      SELECT storage_key
      FROM media_files
      WHERE id = $1 AND user_id = $2
      `,
      [imageId, userId],
    );

    if (imageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Image not found.",
      });
    }

    const { storage_key } = imageResult.rows[0];

    // 2. Build the absolute path of the image in local storage.
    const storageDirectory = path.resolve(
      process.cwd(),
      "UploadMediaLocalStorage",
    );

    const imagePath = path.resolve(storageDirectory, storage_key);

    // 3. Prevent path traversal.
    if (!imagePath.startsWith(storageDirectory + path.sep)) {
      return res.status(400).json({
        success: false,
        message: "Invalid image path.",
      });
    }

    // 4. Delete the database record, checking ownership again.
    const deleteResult = await pool.query(
      `
      DELETE FROM media_files
      WHERE id = $1 AND user_id = $2
      RETURNING id
      `,
      [imageId, userId],
    );

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Image not found.",
      });
    }

    // 5. Delete the physical image file.
    try {
      await fs.unlink(imagePath);
    } catch (fileError: unknown) {
      // ENOENT means the file was already missing.
      if (
        fileError instanceof Error &&
        "code" in fileError &&
        fileError.code !== "ENOENT"
      ) {
        console.error("Physical image deletion failed:", fileError);

        return res.status(200).json({
          success: true,
          fileDeleted: false,
          message:
            "Image metadata deleted, but the physical file could not be removed.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      fileDeleted: true,
      message: "Image deleted successfully.",
    });
  } catch (error: unknown) {
    console.error("Delete image error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete image.",
    });
  }
};

/*
1. process.cwd() -> /Users/sakshi/Desktop/Personal-AI-Memory-Action-Assistant/backend (It returns the current working directory of your Node.js process.)
2. path.resolve()  -> /Users/sakshi/Desktop/Personal-AI-Memory-Action-Assistant/backend/UploadMediaLocalStorage (converts path segments into an absolute path.)
3. path.sep -> (path.sep helps distinguish the storage folder from similarly named folders.) Adding path.sep ensures the path must be inside the actual directory, not merely share its name prefix.
4. fs.unlink() -> Node.js filesystem function that deletes a file. (Node.js deletes photo1.jpg from your local filesystem.)
*/

/*
3. What does !res.headersSent mean?

First, understand res.headersSent.

In Express, an HTTP response has headers and a body.

Headers contain information such as:
- HTTP status code (200, 404, etc.)
- Content type (image/jpeg)
- Content length
- Other response metadata

res.headersSent is a Boolean property:
- false: Response headers have not been sent to the client yet.
- true: Response headers have already been sent.

Now consider:
if (error && !res.headersSent) {

It means:
1. Check whether an error occurred.
2. Check whether Express has not already started sending the response.
3. Only then send an error response.
Why is this important with res.sendFile()?

Imagine:
1. Express starts sending a large image.
2. Some part of the file is successfully sent.
3. An error occurs while sending the remaining data.
4. The response headers have already been sent.
You cannot safely send another JSON response such as:
res.status(404).json({
  message: "Image not found",
});


The response has already started. Trying to send another response can cause an error such as ERR_HTTP_HEADERS_SENT.

So:
!res.headersSent


protects you from attempting to send a second response.

Important: It doesn't mean the entire response has finished. It only tells you whether the headers have been sent.
*/

/**
 fileError.code !== "ENOENT"
ENOENT is a Node.js filesystem error code meaning:

Error NO ENTry — the requested file or directory does not exist.

Imagine these two scenarios:
Scenario 1
File already missing

fileError.code === "ENOENT"

Your condition evaluates to false because the error is ENOENT.

The error is ignored, and execution continues to the success response.


Scenario 2
Other deletion failure

fileError.code === "EACCES"

For example, permission denied.

Your condition evaluates to true, so the error is logged and your controller returns fileDeleted: false.
 */
