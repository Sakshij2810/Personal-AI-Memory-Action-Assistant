import pool from "../config/db.js";
import imageAnalysisQueue from "../queues/analysis.queue.js";
import mediaProcessingQueue from "../queues/media.queue.js";
import { UploadedImage } from "../types/types.js";

// -------------------------------------------------------------------------- Helpers --------------------------------------------------------------------------

// save Image Meta data into DB
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

// -------------------------------------------------------------------------- Media queue / workers Helpers --------------------------------------------------------------------------

// Create Jobs for each image : Add uploaded images to the BullMQ processing queue. enqueueMediaProcessingJobs
export const enqueueMediaProcessingJobs = async (
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
    opts: {
      jobId: image.id, // This assigns the media UUID as the BullMQ job ID.
    },
  }));

  return await mediaProcessingQueue.addBulk(jobs);
};

// Recover media jobs that were saved in PostgreSQL but never queued in BullMQ.
export const recoverUnqueuedMediaJobs = async () => {
  // 1. Find images waiting for background processing.
  const result = await pool.query(
    `
    SELECT id, user_id, storage_key
    FROM media_files
    WHERE processing_status = 'uploaded'
    ORDER BY uploaded_at ASC
    `,
  );

  // 2. Check whether each image already has a BullMQ job.
  const images = result.rows;

  for (const image of images) {
    const existingJob = await mediaProcessingQueue.getJob(image.id);

    // 3. If the job already exists, skip it.
    if (existingJob) {
      const jobState = await existingJob.getState();

      // A job in these states is already present in the processing pipeline.
      if (
        ["waiting", "active", "delayed", "waiting-children", "paused"].includes(
          jobState,
        )
      ) {
        continue;
      }

      /*
       - This handles retained completed or failed jobs when the database still says uploaded.
       -  Completed or failed jobs need reconciliation.
       - Remove the old job before creating a replacement. 
       */
      await existingJob.remove();
    }

    // 4. If the job doesn't exist, add it again.
    await mediaProcessingQueue.add(
      "process-image",
      {
        mediaId: image.id,
        userId: image.user_id,
        storageKey: image.storage_key,
      },
      {
        jobId: image.id,
      },
    );

    console.log(`Recovered missing job for media: ${image.id}`);
  }
};

// Recover records stuck in processing
/*
But imagine this sequence:
1. Worker picks up an image.
2. PostgreSQL status changes to processing.
3. Worker crashes before completing the image.
4. BullMQ may eventually mark the job as failed or make it available for retry.
5. PostgreSQL can remain stuck at processing.

Our solution: Use processing_started_at to identify records that have been processing for too long, check their BullMQ job state, and recover only jobs that are no longer active.

We'll use a 5-minute stale threshold initially. This is a recovery threshold, not a processing timeout.
*/
export const recoverStuckProcessingJobs = async () => {
  // Find media records that have been processing for more than 5 minutes.
  // NULL timestamps are included to catch inconsistent/older records.
  const result = await pool.query(
    `
    SELECT id, user_id, storage_key
    FROM media_files
    WHERE processing_status = 'processing'
      AND (
        processing_started_at IS NULL
        OR processing_started_at < NOW() - INTERVAL '5 minutes'
      )
    ORDER BY processing_started_at ASC NULLS FIRST
    `,
  );

  for (const image of result.rows) {
    const existingJob = await mediaProcessingQueue.getJob(image.id);

    // No BullMQ job exists: recreate it.
    if (!existingJob) {
      await mediaProcessingQueue.add(
        "process-image",
        {
          mediaId: image.id,
          userId: image.user_id,
          storageKey: image.storage_key,
        },
        { jobId: image.id },
      );

      console.log(`Recovered stuck media job: ${image.id}`);
      continue;
    }

    const jobState = await existingJob.getState();

    // BullMQ still knows about this job.
    // Let BullMQ handle active, waiting and delayed jobs.
    if (
      [
        "active",
        "waiting",
        "delayed",
        "waiting-children",
        "paused",
        "prioritized",
      ].includes(jobState)
    ) {
      continue;
    }

    // A terminally failed job may have missed its PostgreSQL update.
    if (jobState === "failed") {
      await pool.query(
        `
        UPDATE media_files
        SET processing_status = 'failed',
            processing_started_at = NULL,
            updated_at = NOW()
        WHERE id = $1 AND user_id = $2
          AND processing_status = 'processing'
        `,
        [image.id, image.user_id],
      );

      console.log(`Reconciled failed media: ${image.id}`);
      continue;
    }

    // A completed BullMQ job with a processing DB status is inconsistent.
    // Leave it untouched for explicit reconciliation.
    if (jobState === "completed") {
      console.error(
        `Inconsistent state: media ${image.id} is processing in PostgreSQL but completed in BullMQ.`,
      );
    }
  }
};

// -------------------------------------------------------------------------- Image queue / workers Helpers --------------------------------------------------------------------------

// Enqueue independent image-analysis jobs.
export const enqueueImageAnalysisJob = async (
  mediaId: string,
  userId: string,
) => {
  return imageAnalysisQueue.add(
    "analyze-image",
    {
      mediaId,
      userId,
    },
    {
      jobId: `analysis-${mediaId}`,
    },
  );
};
