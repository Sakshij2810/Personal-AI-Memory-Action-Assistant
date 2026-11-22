import pool from "../config/db.js";
import imageAnalysisQueue from "../queues/analysis.queue.js";
import { updateAnalysisStatus } from "../services/ai/analysis.repository.js";

// -------------------------------------------------------------------------- Image Analysis queue / workers Helpers --------------------------------------------------------------------------

interface MediaForAnalysis {
  id: string;
  user_id: string;
}

interface StuckAnalysis {
  media_file_id: string;
  user_id: string;
}

const ACTIVE_JOB_STATES = [
  "waiting",
  "active",
  "delayed",
  "waiting-children",
  "paused",
  "prioritized",
];

// -------------------------------------------------- enqueue Image Analysis Jobs --------------------------------------------------

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

// -------------------------------------------------- recover Unqueued Image Analysis Jobs --------------------------------------------------
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

// -------------------------------------------------- recover Stuck Image Analysis Jobs --------------------------------------------------

/*

          Find stale processing records
                    |
                    v
             Check BullMQ job
                    |
       +------------+------------+
       |            |             |
    Missing       Active       Terminal
       |            |             |
    Requeue       Skip       Check state
                                |
                    +-----------+-----------+
                    |           |           |
                 Failed      Completed   Failed with
                exhausted       |       attempts left
                    |           |           |
               Mark DB       Remove &    Remove &
                failed        requeue     requeue

*/

// Recover analysis records that have been processing for more than 5 minutes.
export const recoverStuckImageAnalysisJobs = async () => {
  const result = await pool.query<StuckAnalysis>(
    `
    SELECT
      analysis.media_file_id,
      media.user_id
    FROM media_analysis AS analysis
    INNER JOIN media_files AS media
      ON media.id = analysis.media_file_id
    WHERE
      analysis.status = 'processing'
      AND media.status = 'uploaded'
      AND analysis.analysis_started_at < NOW() - INTERVAL '5 minutes'
    ORDER BY analysis.analysis_started_at ASC
    `,
  );

  let requeued = 0;
  let markedFailed = 0;
  let skipped = 0;

  for (const media of result.rows) {
    const jobId = `analysis-${media.media_file_id}`;

    try {
      const existingJob = await imageAnalysisQueue.getJob(jobId);

      // Case 1: The job does not exist in BullMQ.
      if (!existingJob) {
        await imageAnalysisQueue.add(
          "analyze-image",
          {
            mediaId: media.media_file_id,
            userId: media.user_id,
          },
          { jobId },
        );

        requeued++;
        console.log(`Recovered missing analysis job: ${media.media_file_id}`);
        continue;
      }

      const jobState = await existingJob.getState();

      // Case 2: BullMQ is already handling this job.
      if (ACTIVE_JOB_STATES.includes(jobState)) {
        skipped++;
        continue;
      }

      // Case 3: The job failed and exhausted all configured attempts.
      if (jobState === "failed") {
        const maxAttempts = existingJob.opts.attempts ?? 1;

        if (existingJob.attemptsMade >= maxAttempts) {
          await updateAnalysisStatus(
            media.media_file_id,
            "failed",
            existingJob.failedReason ||
              "Analysis job failed after all retries.",
          );

          markedFailed++;
          console.log(`Reconciled failed analysis: ${media.media_file_id}`);
          continue;
        }
      }

      /*
       * Case 4:
       * - The job completed, but the database still says processing.
       * - Or the job failed without exhausting its attempts.
       *
       * Remove the retained terminal job and enqueue a fresh one.
       */
      await existingJob.remove();

      await imageAnalysisQueue.add(
        "analyze-image",
        {
          mediaId: media.media_file_id,
          userId: media.user_id,
        },
        { jobId },
      );

      requeued++;
      console.log(`Requeued stale analysis: ${media.media_file_id}`);
    } catch (error) {
      console.error(
        `Failed to recover analysis ${media.media_file_id}:`,
        error,
      );
    }
  }

  console.log("Image analysis stale recovery completed:", {
    scanned: result.rows.length,
    requeued,
    markedFailed,
    skipped,
  });

  return {
    scanned: result.rows.length,
    requeued,
    markedFailed,
    skipped,
  };
};
