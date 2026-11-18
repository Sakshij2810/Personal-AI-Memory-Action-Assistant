import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
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
import mediaProcessingQueue from "../queues/media.queue.js";
import { mediaWorker, closeMediaWorker } from "../workers/media.worker.js";

import { mediaStorageDir, mediaThumbnailDir } from "../config/media-storage.js";

describe("Media worker integration tests", () => {
  let userId: string;
  let jobIds: string[] = [];

  beforeAll(async () => {
    const dbResult = await pool.query("SELECT current_database() AS name");

    if (dbResult.rows[0].name !== "memora_ai_test") {
      throw new Error("Unsafe database. Expected memora_ai_test.");
    }

    const redisUrl = new URL(process.env.REDIS_URL!);

    if (redisUrl.pathname !== "/1") {
      throw new Error("Unsafe Redis database. Expected Redis DB 1.");
    }

    await redis.ping();
    await bullmqRedis.ping();

    await mediaProcessingQueue.waitUntilReady();
    await mediaWorker.waitUntilReady();

    await fs.mkdir(mediaStorageDir, { recursive: true });
    await fs.mkdir(mediaThumbnailDir, { recursive: true });
  });

  beforeEach(async () => {
    jobIds = [];

    const firebaseUid = `worker-test-${crypto.randomUUID()}`;

    const result = await pool.query(
      `
      INSERT INTO users (firebase_uid, email, display_name)
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [firebaseUid, `${firebaseUid}@example.com`, "Worker Integration Test"],
    );

    userId = result.rows[0].id;
  });

  afterEach(async () => {
    // Restore mocked Sharp/filesystem methods before cleanup.
    vi.restoreAllMocks();

    const result = await pool.query(
      `
      SELECT id, storage_key, thumbnail_key
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

      if (media.thumbnail_key) {
        await fs.rm(path.join(mediaThumbnailDir, media.thumbnail_key), {
          force: true,
        });
      }
    }

    for (const jobId of jobIds) {
      const job = await mediaProcessingQueue.getJob(jobId);

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
    await closeMediaWorker();
    await mediaProcessingQueue.close();
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
      [userId, "worker-test.png", storageKey, "image/png", fileStats.size],
    );

    return {
      mediaId: result.rows[0].id,
      storageKey,
      originalPath,
    };
  };

  const enqueueJob = async (
    mediaId: string,
    storageKey: string,
    jobId: string = mediaId,
  ) => {
    jobIds.push(jobId);

    return mediaProcessingQueue.add(
      "process-image",
      {
        mediaId,
        userId,
        storageKey,
      },
      {
        jobId,
      },
    );
  };

  const waitForJobCompletion = async (jobId: string) => {
    await vi.waitFor(
      async () => {
        const job = await mediaProcessingQueue.getJob(jobId);

        expect(job).toBeDefined();

        expect(await job!.getState()).toBe("completed");
      },
      {
        timeout: 15000,
        interval: 100,
      },
    );
  };

  const waitForJobFailure = async (jobId: string) => {
    await vi.waitFor(
      async () => {
        const job = await mediaProcessingQueue.getJob(jobId);

        expect(job).toBeDefined();

        expect(await job!.getState()).toBe("failed");
      },
      {
        timeout: 30000,
        interval: 200,
      },
    );
  };

  // ==================================================
  // TEST 1: NORMAL PROCESSING
  // ==================================================

  it("processes an image and generates its thumbnail", async () => {
    const { mediaId, storageKey, originalPath } = await createUploadedMedia();

    await enqueueJob(mediaId, storageKey);

    await waitForJobCompletion(mediaId);

    const result = await pool.query(
      `
      SELECT
        processing_status,
        thumbnail_key,
        width,
        height,
        format,
        processing_started_at
      FROM media_files
      WHERE id = $1 AND user_id = $2
      `,
      [mediaId, userId],
    );

    expect(result.rowCount).toBe(1);

    const media = result.rows[0];

    expect(media.processing_status).toBe("completed");
    expect(media.thumbnail_key).toBe(`${mediaId}.webp`);
    expect(media.width).toBe(640);
    expect(media.height).toBe(480);
    expect(media.format).toBeDefined();
    expect(media.processing_started_at).toBeNull();

    // Original must remain available.
    await expect(fs.access(originalPath)).resolves.toBeUndefined();

    // Thumbnail must exist.
    const thumbnailPath = path.join(mediaThumbnailDir, media.thumbnail_key);

    await expect(fs.access(thumbnailPath)).resolves.toBeUndefined();

    // Verify the actual thumbnail.
    const thumbnailMetadata = await sharp(thumbnailPath).metadata();

    expect(thumbnailMetadata.format).toBe("webp");
    expect(thumbnailMetadata.width).toBe(300);
    expect(thumbnailMetadata.height).toBe(225);
  });

  // ==================================================
  // TEST 2: IDEMPOTENCY
  // ==================================================

  it("reprocesses the same media without creating duplicate records or thumbnails", async () => {
    const { mediaId, storageKey } = await createUploadedMedia();

    // First processing.
    await enqueueJob(mediaId, storageKey);

    await waitForJobCompletion(mediaId);

    const firstResult = await pool.query(
      `
      SELECT thumbnail_key
      FROM media_files
      WHERE id = $1
      `,
      [mediaId],
    );

    const firstThumbnailKey = firstResult.rows[0].thumbnail_key;

    // Process the same media again with a different job ID.
    const retryJobId = `${mediaId}-retry`;

    await enqueueJob(mediaId, storageKey, retryJobId);

    await waitForJobCompletion(retryJobId);

    const countResult = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM media_files
      WHERE id = $1 AND user_id = $2
      `,
      [mediaId, userId],
    );

    expect(countResult.rows[0].count).toBe(1);

    const secondResult = await pool.query(
      `
      SELECT processing_status, thumbnail_key
      FROM media_files
      WHERE id = $1
      `,
      [mediaId],
    );

    expect(secondResult.rows[0].processing_status).toBe("completed");

    expect(secondResult.rows[0].thumbnail_key).toBe(firstThumbnailKey);

    const thumbnailPath = path.join(mediaThumbnailDir, firstThumbnailKey);

    const metadata = await sharp(thumbnailPath).metadata();

    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(300);
    expect(metadata.height).toBe(225);
  });

  // ==================================================
  // TEST 3: MEDIA DELETED BEFORE PROCESSING
  // ==================================================

  it("skips a queued job when its media record has already been deleted", async () => {
    const { mediaId, storageKey, originalPath } = await createUploadedMedia();

    await mediaWorker.pause();

    try {
      const job = await enqueueJob(mediaId, storageKey);

      await vi.waitFor(
        async () => {
          expect(await job.getState()).toBe("waiting");
        },
        {
          timeout: 5000,
          interval: 100,
        },
      );

      await pool.query(
        `
        DELETE FROM media_files
        WHERE id = $1 AND user_id = $2
        `,
        [mediaId, userId],
      );

      await fs.rm(originalPath, { force: true });

      await mediaWorker.resume();

      await waitForJobCompletion(mediaId);

      const completedJob = await mediaProcessingQueue.getJob(mediaId);

      expect(completedJob?.returnvalue).toEqual({
        success: true,
        skipped: true,
        mediaId,
      });

      const result = await pool.query(
        `
        SELECT id
        FROM media_files
        WHERE id = $1 AND user_id = $2
        `,
        [mediaId, userId],
      );

      expect(result.rowCount).toBe(0);

      const thumbnailPath = path.join(mediaThumbnailDir, `${mediaId}.webp`);

      await expect(fs.access(thumbnailPath)).rejects.toThrow();
    } finally {
      await mediaWorker.resume();
    }
  });

  // ==================================================
  // TEST 4: MEDIA DELETED DURING THUMBNAIL GENERATION
  // ==================================================

  it("does not leave a thumbnail behind when media is deleted during processing", async () => {
    const { mediaId, storageKey, originalPath } = await createUploadedMedia();

    // We pause Sharp's toFile() operation so that the test
    // can delete the PostgreSQL record while processing is running.

    const originalToFile = sharp.prototype.toFile;

    let toFileStarted = false;
    let signalToFileStarted!: () => void;
    let releaseToFile!: () => void;

    const toFileStartedPromise = new Promise<void>((resolve) => {
      signalToFileStarted = resolve;
    });

    const toFileGate = new Promise<void>((resolve) => {
      releaseToFile = resolve;
    });

    const toFileSpy = vi
      .spyOn(sharp.prototype, "toFile")
      .mockImplementation(async function (this: any, ...args: any[]) {
        toFileStarted = true;
        signalToFileStarted();

        // Hold thumbnail generation until the test deletes the row.
        await toFileGate;

        return originalToFile.apply(this, args);
      } as any);

    try {
      await enqueueJob(mediaId, storageKey);

      // Wait until Sharp reaches thumbnail generation.
      await toFileStartedPromise;

      expect(toFileStarted).toBe(true);

      // Delete the database record while Sharp is paused.
      await pool.query(
        `
        DELETE FROM media_files
        WHERE id = $1 AND user_id = $2
        `,
        [mediaId, userId],
      );

      // Allow Sharp to finish generating the thumbnail.
      releaseToFile();

      await waitForJobCompletion(mediaId);

      const completedJob = await mediaProcessingQueue.getJob(mediaId);

      // Worker should recognize that the media row disappeared
      // when it tries to update PostgreSQL.
      expect(completedJob?.returnvalue).toMatchObject({
        success: true,
        skipped: true,
        mediaId,
      });

      const result = await pool.query(
        `
        SELECT id
        FROM media_files
        WHERE id = $1 AND user_id = $2
        `,
        [mediaId, userId],
      );

      expect(result.rowCount).toBe(0);

      // The worker should remove the thumbnail it just generated.
      const thumbnailPath = path.join(mediaThumbnailDir, `${mediaId}.webp`);

      await expect(fs.access(thumbnailPath)).rejects.toThrow();
    } finally {
      // Never leave the worker blocked if an assertion fails.
      releaseToFile();
      toFileSpy.mockRestore();

      await fs.rm(originalPath, { force: true });

      await mediaWorker.resume();
    }
  });

  // ==================================================
  // TEST 5: RETRIES AND PERMANENT FAILURE
  // ==================================================

  it("retries failed image processing and marks media as failed after all attempts", async () => {
    const { mediaId, storageKey, originalPath } = await createUploadedMedia();

    // Deliberately corrupt the original image.
    await fs.writeFile(originalPath, "This is not a valid image");

    await enqueueJob(mediaId, storageKey);

    await waitForJobFailure(mediaId);

    const job = await mediaProcessingQueue.getJob(mediaId);

    expect(job).toBeDefined();
    expect(job!.attemptsMade).toBe(3);
    expect(job!.opts.attempts).toBe(3);

    // Wait for the worker's failed event to update PostgreSQL.
    await vi.waitFor(
      async () => {
        const result = await pool.query(
          `
          SELECT processing_status, processing_started_at
          FROM media_files
          WHERE id = $1 AND user_id = $2
          `,
          [mediaId, userId],
        );

        expect(result.rowCount).toBe(1);
        expect(result.rows[0].processing_status).toBe("failed");
        expect(result.rows[0].processing_started_at).toBeNull();
      },
      {
        timeout: 10000,
        interval: 200,
      },
    );
  });
});
