import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import crypto from "node:crypto";

import pool from "../config/db.js";
import redis from "../shared/redis/redis.js";
import bullmqRedis from "../shared/redis/bullmq-connection.js";
import imageAnalysisQueue from "../queues/analysis.queue.js";

import { env } from "../lib/env.js";

import { recoverUnqueuedImageAnalysisJobs } from "../helpers/analysis.helper.js";

import {
  createAnalysisRecord,
  updateAnalysisStatus,
} from "../services/ai/analysis.repository.js";

describe("Image analysis recovery integration tests", () => {
  let userId: string;

  // ==================================================
  // TEST DATA HELPERS
  // ==================================================

  const createMediaRecord = async (
    processingStatus:
      | "uploaded"
      | "processing"
      | "completed"
      | "failed" = "completed",
  ) => {
    const id = crypto.randomUUID();
    const storageKey = `${id}.jpg`;

    const result = await pool.query(
      `
      INSERT INTO media_files (
        id,
        user_id,
        filename,
        storage_key,
        mime_type,
        file_size,
        status,
        processing_status,
        thumbnail_key
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        id,
        userId,
        storageKey,
        storageKey,
        "image/jpeg",
        1024,
        "uploaded",
        processingStatus,
        processingStatus === "completed" ? `${id}.webp` : null,
      ],
    );

    return result.rows[0];
  };

  const createAnalysisJob = async (mediaId: string) => {
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

  // ==================================================
  // DATABASE AND REDIS SAFETY
  // ==================================================

  beforeAll(async () => {
    const dbResult = await pool.query("SELECT current_database() AS name");

    if (dbResult.rows[0].name !== "memora_ai_test") {
      throw new Error(
        `Unsafe test database: ${dbResult.rows[0].name}. Expected memora_ai_test.`,
      );
    }

    if (!env.DATABASE_URL.includes("memora_ai_test")) {
      throw new Error("Unsafe DATABASE_URL. Expected memora_ai_test.");
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
  });

  // ==================================================
  // TEST USER SETUP
  // ==================================================

  beforeEach(async () => {
    const firebaseUid = `analysis-recovery-${crypto.randomUUID()}`;

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
      [firebaseUid, `${firebaseUid}@example.com`, "Analysis Recovery Test"],
    );

    userId = result.rows[0].id;
  });

  // ==================================================
  // CLEANUP
  // ==================================================

  afterEach(async () => {
    // Restore spies before using the real queue.
    vi.restoreAllMocks();

    const result = await pool.query(
      `
      SELECT id
      FROM media_files
      WHERE user_id = $1
      `,
      [userId],
    );

    for (const media of result.rows) {
      const jobId = `analysis-${media.id}`;
      const job = await imageAnalysisQueue.getJob(jobId);

      if (job) {
        const state = await job.getState();

        if (state !== "active") {
          await job.remove().catch(() => undefined);
        }
      }
    }

    // ON DELETE CASCADE removes media_analysis records too.
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  });

  // ==================================================
  // TEST 1: RECOVER ONE MISSING JOB
  // ==================================================

  it("creates an analysis job for completed media without an analysis record", async () => {
    const media = await createMediaRecord("completed");

    expect(
      await imageAnalysisQueue.getJob(`analysis-${media.id}`),
    ).toBeUndefined();

    await recoverUnqueuedImageAnalysisJobs();

    const job = await imageAnalysisQueue.getJob(`analysis-${media.id}`);

    expect(job).toBeDefined();
    expect(job?.name).toBe("analyze-image");

    expect(job?.data).toMatchObject({
      mediaId: media.id,
      userId,
    });

    expect(await job!.getState()).toBe("waiting");
  });

  // ==================================================
  // TEST 2: RECOVER MULTIPLE MISSING JOBS
  // ==================================================

  it("recovers multiple completed media records in one run", async () => {
    const mediaRecords = [];

    for (let index = 0; index < 5; index++) {
      const media = await createMediaRecord("completed");
      mediaRecords.push(media);
    }

    await recoverUnqueuedImageAnalysisJobs();

    for (const media of mediaRecords) {
      const job = await imageAnalysisQueue.getJob(`analysis-${media.id}`);

      expect(job).toBeDefined();

      expect(job?.data).toMatchObject({
        mediaId: media.id,
        userId,
      });
    }
  });

  // ==================================================
  // TEST 3: DUPLICATE PREVENTION
  // ==================================================

  it("does not create a duplicate when a waiting job already exists", async () => {
    const media = await createMediaRecord("completed");

    const originalJob = await createAnalysisJob(media.id);

    expect(await originalJob.getState()).toBe("waiting");

    await recoverUnqueuedImageAnalysisJobs();

    const jobAfterRecovery = await imageAnalysisQueue.getJob(
      `analysis-${media.id}`,
    );

    expect(jobAfterRecovery).toBeDefined();
    expect(jobAfterRecovery?.id).toBe(originalJob.id);

    expect(await jobAfterRecovery!.getState()).toBe("waiting");
  });

  // ==================================================
  // TEST 4: EXISTING FAILED / COMPLETED JOBS
  // ==================================================

  it.each(["failed", "completed"] as const)(
    "does not recreate an existing %s BullMQ job",
    async (existingState) => {
      const media = await createMediaRecord("completed");

      // Simulate an existing job in the specified state.
      const fakeJob = {
        getState: vi.fn().mockResolvedValue(existingState),
      };

      const getJobSpy = vi
        .spyOn(imageAnalysisQueue, "getJob")
        .mockResolvedValue(fakeJob as any);

      const addSpy = vi.spyOn(imageAnalysisQueue, "add");

      await recoverUnqueuedImageAnalysisJobs();

      expect(getJobSpy).toHaveBeenCalledWith(`analysis-${media.id}`);

      expect(addSpy).not.toHaveBeenCalled();
    },
  );

  // ==================================================
  // TEST 5: IGNORE MEDIA NOT YET COMPLETED
  // ==================================================

  it("does not enqueue analysis for media that is still processing", async () => {
    const media = await createMediaRecord("processing");

    await recoverUnqueuedImageAnalysisJobs();

    const job = await imageAnalysisQueue.getJob(`analysis-${media.id}`);

    expect(job).toBeUndefined();
  });

  // ==================================================
  // TEST 6: IGNORE EXISTING ANALYSIS RECORDS
  // ==================================================

  it("does not enqueue another job when an analysis record already exists", async () => {
    const media = await createMediaRecord("completed");

    await createAnalysisRecord(media.id, "gemini", "gemini-3.5-flash-lite");

    await recoverUnqueuedImageAnalysisJobs();

    const job = await imageAnalysisQueue.getJob(`analysis-${media.id}`);

    expect(job).toBeUndefined();
  });

  // ==================================================
  // TEST 7: DO NOT AUTOMATICALLY RETRY FAILED ANALYSIS
  // ==================================================

  it("does not automatically recreate a job when its analysis record is failed", async () => {
    const media = await createMediaRecord("completed");

    await createAnalysisRecord(media.id, "gemini", "gemini-3.5-flash-lite");

    await updateAnalysisStatus(media.id, "failed", "Gemini request failed");

    await recoverUnqueuedImageAnalysisJobs();

    const job = await imageAnalysisQueue.getJob(`analysis-${media.id}`);

    expect(job).toBeUndefined();
  });
});
