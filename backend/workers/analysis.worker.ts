// backend/workers/analysis.worker.ts

import { Worker } from "bullmq";
import { readFile } from "node:fs/promises";
import path from "node:path";

import bullmqRedis from "../shared/redis/bullmq-connection.js";
import { mediaStorageDir } from "../config/media-storage.js";
import { env } from "../lib/env.js";
import pool from "../config/db.js";

import type { AnalyzeImageJobData } from "../queues/analysis.queue.js";

import { aiService } from "../services/ai/ai.service.js";
import {
  createAnalysisRecord,
  updateAnalysisStatus,
  updateAnalysisResult,
} from "../services/ai/analysis.repository.js";
import { registerAIProviders } from "../services/ai/register.js";
import { recoverUnqueuedImageAnalysisJobs } from "../helpers/analysis.helper.js";

// Register AI providers before processing any jobs.
registerAIProviders();

// Create an independent worker for image analysis.
export const analysisWorker = new Worker<AnalyzeImageJobData>(
  "image-analysis",

  async (job) => {
    const { mediaId, userId } = job.data;

    console.log(`Starting image analysis: ${mediaId}`);

    // 1. Fetch the original image information.
    const mediaResult = await pool.query(
      `
    SELECT id, storage_key, mime_type
    FROM media_files
    WHERE id = $1 AND user_id = $2
  `,
      [mediaId, userId],
    );

    // 2. Skip if the original media was deleted.
    if (mediaResult.rowCount === 0) {
      console.log(`Media ${mediaId} was deleted. Skipping analysis.`);
      return { success: true, skipped: true, mediaId };
    }

    const { storage_key, mime_type } = mediaResult.rows[0];

    // 3. Resolve and validate the original image path.
    const imagePath = path.resolve(mediaStorageDir, storage_key);
    const relativePath = path.relative(mediaStorageDir, imagePath);

    const isSafePath =
      relativePath !== "" &&
      relativePath !== ".." &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath);

    if (!isSafePath) {
      throw new Error("Invalid image storage path.");
    }

    // 4. Create or reuse the analysis record.
    await createAnalysisRecord(mediaId, "gemini", env.GEMINI_MODEL);

    // 5. Mark this analysis attempt as processing.
    await updateAnalysisStatus(mediaId, "processing");

    // 6. Read the original image into a Buffer.
    const imageBuffer = await readFile(imagePath);

    // 7. Ask the AI service to analyse the image.
    const analysis = await aiService.analyzeImage({
      imageBuffer,
      mimeType: mime_type,
    });

    // 8. Save the generated description and labels.
    const savedAnalysis = await updateAnalysisResult(
      mediaId,
      analysis,
      "gemini",
      env.GEMINI_MODEL,
    );

    if (!savedAnalysis) {
      throw new Error(`Analysis record not found for media ${mediaId}.`);
    }

    console.log(`Image analysis completed: ${mediaId}`);

    return {
      success: true,
      mediaId,
      description: analysis.description,
      labels: analysis.labels,
    };
  },

  {
    connection: bullmqRedis,
    concurrency: 1,
  },
);

// Prevent overlapping recovery executions.
let isRecoveryRunning = false;

const runAnalysisRecovery = async () => {
  if (isRecoveryRunning) return;

  isRecoveryRunning = true;

  try {
    await recoverUnqueuedImageAnalysisJobs();
  } catch (error) {
    console.error("Image analysis recovery failed:", error);
  } finally {
    isRecoveryRunning = false;
  }
};

// Worker lifecycle events.
let recoveryInterval: ReturnType<typeof setInterval> | undefined;

analysisWorker.on("ready", () => {
  console.log("Image analysis worker is ready and waiting for jobs...");

  // Recover missing analysis jobs immediately.
  void runAnalysisRecovery();

  // Repeat recovery every 30 seconds.
  if (!recoveryInterval) {
    recoveryInterval = setInterval(() => {
      void runAnalysisRecovery();
    }, 30_000);
  }
});

analysisWorker.on("active", (job) => {
  console.log(`Analysis job ${job.id} is ACTIVE`);
});

analysisWorker.on("completed", (job) => {
  console.log(`Analysis job ${job.id} COMPLETED`);
});

analysisWorker.on("failed", async (job, error) => {
  console.error(`Analysis job ${job?.id} FAILED:`, error.message);

  if (!job) return;

  const maxAttempts = job.opts.attempts ?? 1;

  // Only mark the analysis as failed after all retries are exhausted.
  if (job.attemptsMade >= maxAttempts) {
    const { mediaId } = job.data;

    try {
      await updateAnalysisStatus(mediaId, "failed", error.message);

      console.log(`Analysis ${mediaId} marked as FAILED`);
    } catch (dbError) {
      console.error("Failed to update analysis status:", dbError);
    }
  } else {
    console.log(
      `Retrying analysis... Attempt ${job.attemptsMade} of ${maxAttempts}`,
    );
  }
});

analysisWorker.on("error", (error) => {
  console.error("Analysis worker error:", error);
});

// Allow tests and application shutdown to close the worker.

export const closeAnalysisWorker = async () => {
  if (recoveryInterval) {
    clearInterval(recoveryInterval);
    recoveryInterval = undefined;
  }

  await analysisWorker.close();

  console.log("Image analysis worker closed successfully.");
};
