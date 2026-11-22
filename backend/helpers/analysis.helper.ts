import pool from "../config/db.js";
import imageAnalysisQueue from "../queues/analysis.queue.js";

// --------------------------------------------------------------------------
// Image analysis queue helpers
// --------------------------------------------------------------------------

interface MediaForAnalysis {
  id: string;
  user_id: string;
}

// Enqueue one analysis job for every uploaded image.
export const enqueueImageAnalysisJobs = async (images: MediaForAnalysis[]) => {
  const jobs = images.map((image) => ({
    name: "analyze-image",
    data: {
      mediaId: image.id,
      userId: image.user_id,
    },
    opts: {
      jobId: `analysis-${image.id}`,
    },
  }));

  return imageAnalysisQueue.addBulk(jobs);
};

// --------------------------------------------------------------------------
// Image analysis recovery
// --------------------------------------------------------------------------

export const recoverUnqueuedImageAnalysisJobs = async () => {
  /*
   * IMPORTANT:
   * Do not require media.processing_status = 'completed'.
   *
   * Image analysis uses the original image, so it can run even
   * when thumbnail generation fails.
   *
   * Find media records that do not yet have an analysis record.
   */
  const result = await pool.query<MediaForAnalysis>(
    `
    SELECT
      media.id,
      media.user_id
    FROM media_files AS media
    LEFT JOIN media_analysis AS analysis
      ON analysis.media_file_id = media.id
    WHERE
      media.status = 'uploaded'
      AND analysis.id IS NULL
    ORDER BY media.uploaded_at ASC
    `,
  );

  for (const media of result.rows) {
    const jobId = `analysis-${media.id}`;

    try {
      const existingJob = await imageAnalysisQueue.getJob(jobId);

      if (existingJob) {
        const jobState = await existingJob.getState();

        // These jobs are already in the processing pipeline.
        if (
          [
            "waiting",
            "active",
            "delayed",
            "waiting-children",
            "paused",
            "prioritized",
          ].includes(jobState)
        ) {
          continue;
        }

        /*
         * A completed or failed job without an analysis record
         * is inconsistent.
         *
         * Remove the retained job so it can be recreated.
         */
        await existingJob.remove();
      }

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
