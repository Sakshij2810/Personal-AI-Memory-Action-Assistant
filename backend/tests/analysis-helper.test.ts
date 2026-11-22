// backend/tests/analysis-helper.test.ts

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

  const createMediaRecord = async (
    processingStatus:
      | "uploaded"
      | "processing"
      | "completed"
      | "failed" = "uploaded",
  ) => {
    const id = crypto.randomUUID();
    const storageKey = `${id}.jpg`;

    const result = await pool.query(
      `
      INSERT INTO media_files (
        id, user_id, filename, storage_key, mime_type,
        file_size, status, processing_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
      ],
    );

    return result.rows[0];
  };

  const createAnalysisJob = async (mediaId: string) =>
    imageAnalysisQueue.add(
      "analyze-image",
      { mediaId, userId },
      { jobId: `analysis-${mediaId}` },
    );

  beforeAll(async () => {
    const dbResult = await pool.query("SELECT current_database() AS name");

    if (dbResult.rows[0].name !== "memora_ai_test") {
      throw new Error("Unsafe test database. Expected memora_ai_test.");
    }

    if (!env.DATABASE_URL.includes("memora_ai_test")) {
      throw new Error("Unsafe DATABASE_URL.");
    }

    const redisUrl = new URL(env.REDIS_URL);

    if (redisUrl.pathname !== "/1") {
      throw new Error("Unsafe Redis database. Expected Redis DB 1.");
    }

    await redis.ping();
    await bullmqRedis.ping();
    await imageAnalysisQueue.waitUntilReady();
  });

  beforeEach(async () => {
    const firebaseUid = `analysis-recovery-${crypto.randomUUID()}`;

    const result = await pool.query(
      `
      INSERT INTO users (firebase_uid, email, display_name)
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [firebaseUid, `${firebaseUid}@example.com`, "Analysis Recovery Test"],
    );

    userId = result.rows[0].id;
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    const result = await pool.query(
      "SELECT id FROM media_files WHERE user_id = $1",
      [userId],
    );

    for (const media of result.rows) {
      const job = await imageAnalysisQueue.getJob(`analysis-${media.id}`);

      if (job) {
        const state = await job.getState();

        if (state !== "active") {
          await job.remove().catch(() => undefined);
        }
      }
    }

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  });

  it("enqueues analysis for uploaded media without an analysis record", async () => {
    const media = await createMediaRecord("uploaded");

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

  it.each(["uploaded", "processing", "completed", "failed"] as const)(
    "recovers analysis even when thumbnail processing status is %s",
    async (processingStatus) => {
      const media = await createMediaRecord(processingStatus);

      await recoverUnqueuedImageAnalysisJobs();

      const job = await imageAnalysisQueue.getJob(`analysis-${media.id}`);

      expect(job).toBeDefined();
      expect(job?.data.mediaId).toBe(media.id);
    },
  );

  it("recovers multiple uploaded media records in one run", async () => {
    const mediaRecords = [];

    for (let index = 0; index < 5; index++) {
      mediaRecords.push(await createMediaRecord());
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

  it("does not duplicate an existing waiting job", async () => {
    const media = await createMediaRecord();
    const originalJob = await createAnalysisJob(media.id);

    await recoverUnqueuedImageAnalysisJobs();

    const recoveredJob = await imageAnalysisQueue.getJob(
      `analysis-${media.id}`,
    );

    expect(recoveredJob?.id).toBe(originalJob.id);
    expect(await recoveredJob!.getState()).toBe("waiting");
  });

  it.each(["failed", "completed"] as const)(
    "recreates a retained %s job when no analysis record exists",
    async (existingState) => {
      const media = await createMediaRecord();

      const fakeJob = {
        getState: vi.fn().mockResolvedValue(existingState),
        remove: vi.fn().mockResolvedValue(undefined),
      };

      const getJobSpy = vi
        .spyOn(imageAnalysisQueue, "getJob")
        .mockResolvedValue(fakeJob as any);

      const addSpy = vi
        .spyOn(imageAnalysisQueue, "add")
        .mockResolvedValue({} as any);

      await recoverUnqueuedImageAnalysisJobs();

      expect(getJobSpy).toHaveBeenCalledWith(`analysis-${media.id}`);
      expect(fakeJob.remove).toHaveBeenCalledOnce();
      expect(addSpy).toHaveBeenCalledWith(
        "analyze-image",
        { mediaId: media.id, userId },
        { jobId: `analysis-${media.id}` },
      );
    },
  );

  it("does not enqueue another job when an analysis record already exists", async () => {
    const media = await createMediaRecord();

    await createAnalysisRecord(media.id, "gemini", "gemini-3.5-flash-lite");

    await recoverUnqueuedImageAnalysisJobs();

    const job = await imageAnalysisQueue.getJob(`analysis-${media.id}`);

    expect(job).toBeUndefined();
  });

  it("does not automatically retry an analysis record with failed status", async () => {
    const media = await createMediaRecord();

    await createAnalysisRecord(media.id, "gemini", "gemini-3.5-flash-lite");

    await updateAnalysisStatus(media.id, "failed", "Gemini request failed");

    await recoverUnqueuedImageAnalysisJobs();

    const job = await imageAnalysisQueue.getJob(`analysis-${media.id}`);

    expect(job).toBeUndefined();
  });

  it.each([
    "active",
    "waiting",
    "delayed",
    "waiting-children",
    "paused",
    "prioritized",
  ])("does not replace an existing %s job", async (existingState) => {
    const media = await createMediaRecord();

    const fakeJob = {
      getState: vi.fn().mockResolvedValue(existingState),
      remove: vi.fn(),
    };

    vi.spyOn(imageAnalysisQueue, "getJob").mockResolvedValue(fakeJob as any);

    const addSpy = vi.spyOn(imageAnalysisQueue, "add");

    await recoverUnqueuedImageAnalysisJobs();

    expect(fakeJob.remove).not.toHaveBeenCalled();
    expect(addSpy).not.toHaveBeenCalled();
  });
});
