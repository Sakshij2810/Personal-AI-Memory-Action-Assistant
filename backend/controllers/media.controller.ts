// backend/controllers/media.controller.ts

import { type Request, type Response } from "express";
import fs from "node:fs/promises";
import pool from "../config/db.js";
import path from "node:path";
import { saveImageMetadata } from "../helpers/media.helper.js";
import { enqueueMediaProcessingJobs } from "../helpers/thumbnail.helper.js";
import { mediaStorageDir, mediaThumbnailDir } from "../config/media-storage.js";
import { getAnalysisByMediaId } from "../services/ai/analysis.repository.js";
import { enqueueImageAnalysisJobs } from "../helpers/analysis.helper.js";
import { enqueueFaceProcessingJobs } from "../helpers/face.helper.js";

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

  // 2. Schedule all three independent processing jobs.
  const [mediaResult, analysisResult, faceResult] = await Promise.allSettled([
    enqueueMediaProcessingJobs(images),
    enqueueImageAnalysisJobs(images),
    enqueueFaceProcessingJobs(images),
  ]);

  const mediaQueued = mediaResult.status === "fulfilled";
  const analysisQueued = analysisResult.status === "fulfilled";
  const faceQueued = faceResult.status === "fulfilled";

  if (!mediaQueued) {
    console.error(
      "Failed to enqueue media processing job:",
      mediaResult.reason,
    );
  }

  if (!analysisQueued) {
    console.error(
      "Failed to enqueue image analysis job:",
      analysisResult.reason,
    );
  }

  if (!faceQueued) {
    console.error("Failed to enqueue face processing job:", faceResult.reason);
  }

  // 3. Return the scheduling results.
  return res.status(201).json({
    success: true,
    message: "Image uploaded successfully.",
    processing: {
      mediaQueued,
      analysisQueued,
      faceQueued,
    },
    processingQueued: mediaQueued && analysisQueued && faceQueued,
    image: images[0],
  });
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

  // 2. Schedule all three independent processing pipelines. -> Promise.allSettled() so a failure to enqueue one type doesn't prevent attempting the other type.
  const [mediaResult, analysisResult, faceResult] = await Promise.allSettled([
    enqueueMediaProcessingJobs(images),
    enqueueImageAnalysisJobs(images),
    enqueueFaceProcessingJobs(images),
  ]);

  const mediaJobsQueued =
    mediaResult.status === "fulfilled" ? mediaResult.value.length : 0;

  const analysisJobsQueued =
    analysisResult.status === "fulfilled" ? analysisResult.value.length : 0;

  const faceJobsQueued =
    faceResult.status === "fulfilled" ? faceResult.value.length : 0;

  if (mediaResult.status === "rejected") {
    console.error(
      "Failed to enqueue media processing jobs:",
      mediaResult.reason,
    );
  }

  if (analysisResult.status === "rejected") {
    console.error(
      "Failed to enqueue image analysis jobs:",
      analysisResult.reason,
    );
  }

  if (faceResult.status === "rejected") {
    console.error("Failed to enqueue face processing jobs:", faceResult.reason);
  }

  // 3. Return independent scheduling results.
  return res.status(201).json({
    success: true,
    message: "Images uploaded successfully.",
    count: images.length,
    processing: {
      mediaQueued: mediaJobsQueued === images.length,
      analysisQueued: analysisJobsQueued === images.length,
      faceQueued: faceJobsQueued === images.length,
      mediaJobsQueued,
      analysisJobsQueued,
      faceJobsQueued,
    },
    processingQueued:
      mediaJobsQueued === images.length &&
      analysisJobsQueued === images.length &&
      faceJobsQueued === images.length,
    images,
  });
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
    const storageDirectory = mediaStorageDir;

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
    const thumbnailDirectory = mediaThumbnailDir;

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
  const userId = req.user?.id;
  const imageId = req.params.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  const client = await pool.connect();

  try {
    // 1. Start transaction.
    await client.query("BEGIN");

    // 2. Find image and lock its database record.
    // FOR UPDATE locks the PostgreSQL record during our deletion transaction.
    const imageResult = await client.query(
      `
      SELECT storage_key, thumbnail_key
      FROM media_files
      WHERE id = $1 AND user_id = $2
      FOR UPDATE 
      `,
      [imageId, userId],
    );

    if (imageResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Image not found.",
      });
    }

    const { storage_key, thumbnail_key } = imageResult.rows[0];

    // 3. Resolve storage directories.
    const storageDirectory = mediaStorageDir;

    const thumbnailDirectory = mediaThumbnailDir;

    // 4. Resolve file paths.
    const imagePath = path.resolve(storageDirectory, storage_key);

    const thumbnailPath = thumbnail_key
      ? path.resolve(thumbnailDirectory, thumbnail_key)
      : null;

    // 5. Validate paths to prevent path traversal.
    const isSafePath = (directory: string, filePath: string) => {
      const relativePath = path.relative(directory, filePath);

      return (
        relativePath !== "" &&
        !relativePath.startsWith(`..${path.sep}`) &&
        relativePath !== ".." &&
        !path.isAbsolute(relativePath)
      );
    };

    if (
      !isSafePath(storageDirectory, imagePath) ||
      (thumbnailPath && !isSafePath(thumbnailDirectory, thumbnailPath))
    ) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Invalid file path.",
      });
    }

    // 6. Delete the database record.
    const deleteResult = await client.query(
      `
      DELETE FROM media_files
      WHERE id = $1 AND user_id = $2
      RETURNING id
      `,
      [imageId, userId],
    );

    if (deleteResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Image not found.",
      });
    }

    // 7. Commit database deletion.
    await client.query("COMMIT");

    // 8. Safely delete physical files.
    const deleteFile = async (filePath: string) => {
      try {
        await fs.unlink(filePath);
        return true;
      } catch (error: unknown) {
        // Missing files are already effectively deleted.
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          return true;
        }

        console.error(`File deletion failed: ${filePath}`, error);
        return false;
      }
    };

    const [originalDeleted, thumbnailDeleted] = await Promise.all([
      deleteFile(imagePath),
      thumbnailPath ? deleteFile(thumbnailPath) : Promise.resolve(true),
    ]);

    const cleanupComplete = originalDeleted && thumbnailDeleted;

    // 9. Return cleanup result.
    return res.status(200).json({
      success: true,
      metadataDeleted: true,
      originalDeleted,
      thumbnailDeleted,
      cleanupComplete,
      message: cleanupComplete
        ? "Image and thumbnail deleted successfully."
        : "Image metadata deleted, but some physical files could not be removed.",
    });
  } catch (error: unknown) {
    await client.query("ROLLBACK").catch(() => undefined);

    console.error("Delete image error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete image.",
    });
  } finally {
    client.release();
  }
};

export const getImageAnalysis = async (req: Request, res: Response) => {
  try {
    // 1. Get authenticated user's ID and image ID.
    const userId = req.user?.id;
    const imageId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!imageId) {
      return res.status(400).json({
        success: false,
        message: "Invalid image ID.",
      });
    }

    // 2. Validate authentication.
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // 3. Verify that this image belongs to the logged-in user.
    const imageResult = await pool.query(
      `
      SELECT id
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

    // 4. Fetch the AI analysis record.
    const analysis = await getAnalysisByMediaId(imageId);

    // 5. If the worker hasn't created a record yet,
    // return the default pending state.
    if (!analysis) {
      return res.status(200).json({
        success: true,
        analysis: {
          status: "pending",
          description: null,
          labels: [],
          provider: null,
          model: null,
          attemptCount: 0,
          errorMessage: null,
          analysisStartedAt: null,
          analyzedAt: null,
        },
      });
    }

    // 6. Return the analysis result.
    return res.status(200).json({
      success: true,
      analysis: {
        status: analysis.status,
        description: analysis.description,
        labels: analysis.labels,
        provider: analysis.provider,
        model: analysis.model,
        attemptCount: analysis.attempt_count,
        errorMessage: analysis.error_message,
        analysisStartedAt: analysis.analysis_started_at,
        analyzedAt: analysis.analyzed_at,
      },
    });
  } catch (error: unknown) {
    console.error("Get image analysis error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get image analysis.",
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
