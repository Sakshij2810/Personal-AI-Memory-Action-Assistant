import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import pool from "../config/db.js";
import redis from "../shared/redis/redis.js";
import bullmqRedis from "../shared/redis/bullmq-connection.js";
import imageAnalysisQueue from "../queues/analysis.queue.js";

import { mediaStorageDir } from "../config/media-storage.js";
import { env } from "../lib/env.js";

// Mock only the AI service. The queue, worker and database remain real.
vi.mock("../services/ai/ai.service.js", () => ({
  aiService: {
    analyzeImage: vi.fn(),
  },
}));

import { aiService } from "../services/ai/ai.service.js";
import {
  analysisWorker,
  closeAnalysisWorker,
} from "../workers/analysis.worker.js";

describe("Image analysis worker integration tests", () => {
  let userId: string;
  let jobIds: string[] = [];

  const mockAnalysis = {
    description: "People celebrating a wedding outdoors.",
    labels: [
      { name: "wedding", confidence: 0.95 },
      { name: "outdoor", confidence: 0.9 },
      { name: "celebration", confidence: 0.92 },
    ],
  };

  // ==================================================
  // DATABASE AND REDIS SAFETY
  // ==================================================

  beforeAll(async () => {
    const dbResult = await pool.query("SELECT current_database() AS name");

    if (dbResult.rows[0].name !== "memora_ai_test") {
      throw new Error(
        `Unsafe database: ${dbResult.rows[0].name}. Expected memora_ai_test.`,
      );
    }

    const redisUrl = new URL(env.REDIS_URL);

    if (redisUrl.pathname !== "/1") {
      throw new Error(
        `Unsafe Redis database: ${redisUrl.pathname}. Expected /1.`,
      );
    }

    await redis.ping();
    await bullmqRedis.ping();

    await imageAnalysisQueue.waitUntilReady();
    await analysisWorker.waitUntilReady();

    await fs.mkdir(mediaStorageDir, { recursive: true });
  });

  // ==================================================
  // TEST DATA SETUP
  // ==================================================

  beforeEach(async () => {
    jobIds = [];

    vi.mocked(aiService.analyzeImage).mockReset();

    const firebaseUid = `analysis-worker-${crypto.randomUUID()}`;

    const result = await pool.query(
      `
      INSERT INTO users (
        firebase_uid,
        email,
        display_name
      )
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [firebaseUid, `${firebaseUid}@example.com`, "Analysis Worker Test"],
    );

    userId = result.rows[0].id;
  });

  // ==================================================
  // CLEANUP
  // ==================================================

  afterEach(async () => {
    // Restore mocked functions before filesystem/database cleanup.
    vi.restoreAllMocks();

    const result = await pool.query(
      `
      SELECT storage_key
      FROM media_files
      WHERE user_id = $1
      `,
      [userId],
    );

    for (const media of result.rows) {
      if (media.storage_key) {
        await fs.rm(path.join(mediaStorageDir, media.storage_key), {
          force: true,
        });
      }
    }

    for (const jobId of jobIds) {
      const job = await imageAnalysisQueue.getJob(jobId);

      if (job) {
        try {
          const state = await job.getState();

          if (state !== "active") {
            await job.remove();
          }
        } catch {
          // Ignore jobs that are no longer removable.
        }
      }
    }

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  });

  afterAll(async () => {
    await closeAnalysisWorker();
    await imageAnalysisQueue.close();
    await bullmqRedis.quit();
    await redis.quit();
    await pool.end();
  });

  // ==================================================
  // HELPERS
  // ==================================================

  const createUploadedMedia = async () => {
    const storageKey = `${crypto.randomUUID()}.png`;
    const originalPath = path.join(mediaStorageDir, storageKey);

    const imageBuffer = await sharp({
      create: {
        width: 640,
        height: 480,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    await fs.writeFile(originalPath, imageBuffer);

    const fileStats = await fs.stat(originalPath);

    const result = await pool.query(
      `
      INSERT INTO media_files (
        user_id,
        filename,
        storage_key,
        mime_type,
        file_size
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
      `,
      [
        userId,
        "analysis-worker-test.png",
        storageKey,
        "image/png",
        fileStats.size,
      ],
    );

    return {
      mediaId: result.rows[0].id,
      storageKey,
      originalPath,
    };
  };

  const enqueueJob = async (
    mediaId: string,
    jobId: string = `analysis-${mediaId}`,
  ) => {
    jobIds.push(jobId);

    return imageAnalysisQueue.add(
      "analyze-image",
      {
        mediaId,
        userId,
      },
      {
        jobId,
      },
    );
  };

  const waitForJobState = async (
    jobId: string,
    expectedState: "completed" | "failed",
    timeout = 15000,
  ) => {
    await vi.waitFor(
      async () => {
        const job = await imageAnalysisQueue.getJob(jobId);

        expect(job).toBeDefined();
        expect(await job!.getState()).toBe(expectedState);
      },
      {
        timeout,
        interval: 100,
      },
    );
  };

  // ==================================================
  // TEST 1: SUCCESSFUL IMAGE ANALYSIS
  // ==================================================

  it("analyses an image and saves its description and labels", async () => {
    const { mediaId, originalPath } = await createUploadedMedia();

    vi.mocked(aiService.analyzeImage).mockResolvedValue(mockAnalysis);

    const jobId = `analysis-${mediaId}`;

    await enqueueJob(mediaId);

    await waitForJobState(jobId, "completed");

    // Verify that the AI service received the original image.
    expect(aiService.analyzeImage).toHaveBeenCalledTimes(1);

    const aiInput = vi.mocked(aiService.analyzeImage).mock.calls[0][0];

    expect(aiInput.mimeType).toBe("image/png");
    expect(Buffer.isBuffer(aiInput.imageBuffer)).toBe(true);

    await expect(fs.access(originalPath)).resolves.toBeUndefined();

    // Verify the saved PostgreSQL analysis.
    const result = await pool.query(
      `
      SELECT
        description,
        labels,
        provider,
        model,
        status,
        attempt_count,
        error_message,
        analyzed_at
      FROM media_analysis
      WHERE media_file_id = $1
      `,
      [mediaId],
    );

    expect(result.rowCount).toBe(1);

    const analysis = result.rows[0];

    expect(analysis.description).toBe(mockAnalysis.description);
    expect(analysis.labels).toEqual(mockAnalysis.labels);
    expect(analysis.provider).toBe("gemini");
    expect(analysis.model).toBe(env.GEMINI_MODEL);
    expect(analysis.status).toBe("completed");
    expect(analysis.attempt_count).toBe(1);
    expect(analysis.error_message).toBeNull();
    expect(analysis.analyzed_at).toBeInstanceOf(Date);
  });

  // ==================================================
  // TEST 2: IDEMPOTENCY
  // ==================================================

  it("reuses the existing analysis record when the same media is processed again", async () => {
    const { mediaId } = await createUploadedMedia();

    vi.mocked(aiService.analyzeImage).mockResolvedValue(mockAnalysis);

    // First analysis.
    await enqueueJob(mediaId);

    await waitForJobState(`analysis-${mediaId}`, "completed");

    const firstResult = await pool.query(
      `
      SELECT id
      FROM media_analysis
      WHERE media_file_id = $1
      `,
      [mediaId],
    );

    const firstAnalysisId = firstResult.rows[0].id;

    // Process the same media with a different BullMQ job ID.
    const retryJobId = `analysis-${mediaId}-retry`;

    await enqueueJob(mediaId, retryJobId);

    await waitForJobState(retryJobId, "completed");

    const secondResult = await pool.query(
      `
      SELECT id, status, attempt_count
      FROM media_analysis
      WHERE media_file_id = $1
      `,
      [mediaId],
    );

    expect(secondResult.rowCount).toBe(1);
    expect(secondResult.rows[0].id).toBe(firstAnalysisId);
    expect(secondResult.rows[0].status).toBe("completed");
    expect(secondResult.rows[0].attempt_count).toBe(2);
  });

  // ==================================================
  // TEST 3: RETRIES AND PERMANENT FAILURE
  // ==================================================

  it("retries failed AI requests and marks analysis as failed after all attempts", async () => {
    const { mediaId } = await createUploadedMedia();

    vi.mocked(aiService.analyzeImage).mockRejectedValue(
      new Error("Simulated Gemini API failure"),
    );

    const jobId = `analysis-${mediaId}`;

    await enqueueJob(mediaId);

    // Queue configuration allows three attempts.
    await waitForJobState(jobId, "failed", 30000);

    const job = await imageAnalysisQueue.getJob(jobId);

    expect(job).toBeDefined();
    expect(job!.attemptsMade).toBe(3);
    expect(job!.opts.attempts).toBe(3);

    expect(aiService.analyzeImage).toHaveBeenCalledTimes(3);

    // The failed event updates PostgreSQL asynchronously.
    await vi.waitFor(
      async () => {
        const result = await pool.query(
          `
          SELECT
            status,
            attempt_count,
            error_message
          FROM media_analysis
          WHERE media_file_id = $1
          `,
          [mediaId],
        );

        expect(result.rowCount).toBe(1);
        expect(result.rows[0].status).toBe("failed");
        expect(result.rows[0].attempt_count).toBe(3);
        expect(result.rows[0].error_message).toBe(
          "Simulated Gemini API failure",
        );
      },
      {
        timeout: 10000,
        interval: 200,
      },
    );
  });

  // ==================================================
  // TEST 4: MEDIA DELETED BEFORE PROCESSING
  // ==================================================

  it("skips the analysis job when the media record has been deleted", async () => {
    const { mediaId, originalPath } = await createUploadedMedia();

    // Pause the worker so the job cannot start before deletion.
    await analysisWorker.pause();

    try {
      const job = await enqueueJob(mediaId);

      expect(await job.getState()).toBe("waiting");

      // Delete the media record before processing.
      await pool.query(
        `
        DELETE FROM media_files
        WHERE id = $1 AND user_id = $2
        `,
        [mediaId, userId],
      );

      await fs.rm(originalPath, { force: true });

      await analysisWorker.resume();

      await waitForJobState(`analysis-${mediaId}`, "completed");

      const completedJob = await imageAnalysisQueue.getJob(
        `analysis-${mediaId}`,
      );

      expect(completedJob?.returnvalue).toEqual({
        success: true,
        skipped: true,
        mediaId,
      });

      // AI must never be called for deleted media.
      expect(aiService.analyzeImage).not.toHaveBeenCalled();

      // No analysis record should have been created.
      const result = await pool.query(
        `
        SELECT id
        FROM media_analysis
        WHERE media_file_id = $1
        `,
        [mediaId],
      );

      expect(result.rowCount).toBe(0);
    } finally {
      // Ensure the worker is not left paused if an assertion fails.
      await analysisWorker.resume();
    }
  });
});
