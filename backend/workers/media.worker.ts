import { Worker } from "bullmq";
import bullmqRedis from "../shared/redis/bullmq-connection.js";
import pool from "../config/db.js";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

/* One important operational point: Keep the worker running in its own terminal. Your Express server and worker will be separate running processes.
 */

const mediaWorker = new Worker(
  "media-processing",
  /* 1. name of queue
      - It must match the queue name we used in media.queue.ts.
      - The worker doesn't need to import the queue instance itself. It connects to the same named queue through Redis.
   */

  // 2. processing function
  async (job) => {
    const { mediaId, userId, storageKey } = job.data;

    console.log(`Processing media: ${mediaId}`);

    // 1. Mark the media as processing.
    await pool.query(
      `UPDATE media_files
       SET processing_status = 'processing'
       WHERE id = $1 AND user_id = $2`,
      [mediaId, userId],
    );

    // 2. Locate the original image.
    const originalPath = path.resolve(
      process.cwd(),
      "UploadMediaLocalStorage",
      storageKey,
    );

    // 3. Prepare the thumbnail directory.
    const thumbnailDirectory = path.resolve(
      process.cwd(),
      "UploadMediaThumbnails",
    );

    await mkdir(thumbnailDirectory, { recursive: true });

    // 4. Extract original image metadata.
    const metadata = await sharp(originalPath).metadata();

    // 5. Generate a thumbnail.
    const thumbnailKey = `${mediaId}.webp`;

    const thumbnailPath = path.join(thumbnailDirectory, thumbnailKey);

    const thumbnailResult = await sharp(originalPath)
      .resize({
        width: 300,
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toFile(thumbnailPath);

    // 6. Save processing results in PostgreSQL.
    await pool.query(
      `UPDATE media_files
       SET thumbnail_key = $1,
           width = $2,
           height = $3,
           format = $4,
           processing_status = 'completed'
       WHERE id = $5 AND user_id = $6`,
      [
        thumbnailKey,
        metadata.width ?? null,
        metadata.height ?? null,
        metadata.format ?? null,
        mediaId,
        userId,
      ],
    );

    console.log(`Media ${mediaId} processed successfully!`);

    // 7. Return the job result.
    return {
      success: true,
      mediaId,
      thumbnailKey,
      width: metadata.width,
      height: metadata.height,
      thumbnailSize: thumbnailResult.size,
    };
  },

  // 3. connection with redis and concurrency:1 (only perform 1 job at a time)
  {
    connection: bullmqRedis,
    concurrency: 1,
  },
);

// Worker lifecycle events
mediaWorker.on("ready", () => {
  console.log("Media worker is ready and waiting for jobs...");
});

mediaWorker.on("active", (job) => {
  console.log(`Job ${job.id} is now ACTIVE`);
});

mediaWorker.on("completed", (job, result) => {
  console.log(`Job ${job.id} is now COMPLETED`);
  console.log("Result:", result);
});

mediaWorker.on("failed", async (job, error) => {
  console.error(`Job ${job?.id} FAILED:`, error.message);

  if (!job) return;

  const maxAttempts = job.opts.attempts ?? 1;

  // Check whether all attempts have been exhausted.
  if (job.attemptsMade >= maxAttempts) {
    const { mediaId, userId } = job.data;

    console.log(`All attempts exhausted for media: ${mediaId}`);

    try {
      await pool.query(
        `UPDATE media_files
         SET processing_status = 'failed'
         WHERE id = $1 AND user_id = $2`,
        [mediaId, userId],
      );

      console.log(`Media ${mediaId} marked as FAILED in PostgreSQL`);
    } catch (dbError) {
      console.error("Failed to update media status:", dbError);
    }
  } else {
    console.log(
      `Retrying job... Attempt ${job.attemptsMade} of ${maxAttempts}`,
    );
  }
});

mediaWorker.on("error", (error) => {
  console.error("Worker error:", error);
});
