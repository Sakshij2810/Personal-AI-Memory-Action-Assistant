import { faceQueue } from "../queues/face.queue.js";
import type { ProcessFaceJobData } from "../queues/face.queue.js";
import pool from "../config/db.js";

interface MediaForFaceProcessing {
  id: string;
  user_id: string;
}

const ACTIVE_JOB_STATES = new Set([
  "active",
  "waiting",
  "waiting-children",
  "delayed",
  "prioritized",
  "paused",
]);

const enqueueOne = async (data: ProcessFaceJobData) => {
  const jobId = `face-${data.mediaId}`;
  const existingJob = await faceQueue.getJob(jobId);

  if (existingJob) {
    const state = await existingJob.getState();

    if (ACTIVE_JOB_STATES.has(state)) {
      return existingJob;
    }

    // Remove retained completed/failed jobs so the job can run again.
    await existingJob.remove();
  }

  return faceQueue.add("process-faces", data, { jobId });
};

/**
 * Enqueues face processing for newly uploaded media.
 */
export const enqueueFaceProcessingJobs = async (
  images: MediaForFaceProcessing[],
) => {
  return Promise.all(
    images.map((image) =>
      enqueueOne({
        mediaId: image.id,
        userId: image.user_id,
      }),
    ),
  );
};

/**
 * Finds pending media whose face-processing job is missing.
 */
export const recoverUnqueuedFaceProcessingJobs = async () => {
  const result = await pool.query<MediaForFaceProcessing>(
    `
    SELECT id, user_id
    FROM media_files
    WHERE status = 'uploaded'
      AND face_processing_status = 'pending'
    ORDER BY uploaded_at ASC
    LIMIT 100
    `,
  );

  for (const media of result.rows) {
    await enqueueOne({
      mediaId: media.id,
      userId: media.user_id,
    });
  }

  if (result.rowCount) {
    console.log(
      `Face recovery: checked ${result.rowCount} pending media records.`,
    );
  }
};

/**
 * Recovers face jobs stuck in processing.
 */
export const recoverStuckFaceProcessingJobs = async () => {
  const result = await pool.query<MediaForFaceProcessing>(
    `
    SELECT id, user_id
    FROM media_files
    WHERE face_processing_status = 'processing'
      AND face_processing_started_at < NOW() - INTERVAL '5 minutes'
    ORDER BY face_processing_started_at ASC
    LIMIT 100
    `,
  );

  for (const media of result.rows) {
    const jobId = `face-${media.id}`;
    const job = await faceQueue.getJob(jobId);

    if (!job) {
      console.warn(`Face job missing for ${media.id}. Re-enqueueing.`);

      await enqueueOne({
        mediaId: media.id,
        userId: media.user_id,
      });

      continue;
    }

    const state = await job.getState();

    if (ACTIVE_JOB_STATES.has(state)) {
      continue;
    }

    if (state === "completed") {
      // The database may not have been updated correctly.
      // Re-run the idempotent persistence pipeline.
      await job.remove();

      await enqueueOne({
        mediaId: media.id,
        userId: media.user_id,
      });

      continue;
    }

    const maxAttempts = job.opts.attempts ?? 1;

    if (state === "failed" && job.attemptsMade >= maxAttempts) {
      await pool.query(
        `
        UPDATE media_files
        SET
          face_processing_status = 'failed',
          face_processing_started_at = NULL,
          face_processing_error = COALESCE(
            face_processing_error,
            'Face processing retries exhausted.'
          ),
          updated_at = NOW()
        WHERE id = $1
          AND face_processing_status = 'processing'
        `,
        [media.id],
      );

      continue;
    }

    // Failed with attempts remaining, or another terminal state.
    await job.remove();

    await enqueueOne({
      mediaId: media.id,
      userId: media.user_id,
    });
  }

  if (result.rowCount) {
    console.log(
      `Face recovery: checked ${result.rowCount} stuck media records.`,
    );
  }
};
