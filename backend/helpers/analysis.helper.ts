import pool from "../config/db.js";
import imageAnalysisQueue from "../queues/analysis.queue.js";

// Recover completed images that don't have an analysis record.
export const recoverUnqueuedImageAnalysisJobs = async () => {
  const result = await pool.query<{
    id: string;
    user_id: string;
  }>(
    `
      SELECT
        media.id,
        media.user_id
      FROM media_files AS media
      LEFT JOIN media_analysis AS analysis
        ON analysis.media_file_id = media.id
      WHERE
        media.processing_status = 'completed'
        AND analysis.id IS NULL
      ORDER BY media.uploaded_at ASC;
    `,
  );

  for (const media of result.rows) {
    const jobId = `analysis-${media.id}`;

    try {
      // Check whether this job already exists.
      const existingJob = await imageAnalysisQueue.getJob(jobId);

      if (existingJob) {
        // A job already exists, regardless of its current state.
        // Let BullMQ or a future manual retry mechanism handle it.
        continue;
      }

      // Recreate the missing analysis job.
      await imageAnalysisQueue.add(
        "analyze-image",
        {
          mediaId: media.id,
          userId: media.user_id,
        },
        {
          jobId,
        },
      );

      console.log(`Recovered image-analysis job: ${media.id}`);
    } catch (error) {
      console.error(`Failed to recover analysis job for ${media.id}:`, error);
    }
  }

  return result.rows.length;
};
