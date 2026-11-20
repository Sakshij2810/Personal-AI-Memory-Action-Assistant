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

import request from "supertest";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import app from "../app.js";
import pool from "../config/db.js";
import redis from "../shared/redis/redis.js";
import bullmqRedis from "../shared/redis/bullmq-connection.js";
import mediaProcessingQueue from "../queues/media.queue.js";

import {
  recoverUnqueuedMediaJobs,
  recoverStuckProcessingJobs,
} from "../helpers/media.helper.js";

import { mediaStorageDir, mediaThumbnailDir } from "../config/media-storage.js";
import { env } from "../lib/env.js";

describe("Media recovery and deletion integration tests", () => {
  let userId: string;
  let sessionId: string;

  const createPng = async () =>
    sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

  const createMediaRecord = async (
    options: {
      processingStatus?: "uploaded" | "processing" | "completed" | "failed";
      processingStartedAt?: string | null;
      storageKey?: string;
      thumbnailKey?: string | null;
    } = {},
  ) => {
    const id = crypto.randomUUID();
    const storageKey = options.storageKey ?? `${id}.png`;

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
        processing_started_at,
        thumbnail_key
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
      `,
      [
        id,
        userId,
        storageKey,
        storageKey,
        "image/png",
        1000,
        "uploaded",
        options.processingStatus ?? "uploaded",
        options.processingStartedAt ?? null,
        options.thumbnailKey ?? null,
      ],
    );

    return result.rows[0];
  };

  const makeMediaStale = async (mediaId: string) => {
    await pool.query(
      `
      UPDATE media_files
      SET processing_started_at = NOW() - INTERVAL '10 minutes'
      WHERE id = $1
      `,
      [mediaId],
    );
  };

  const createSessionUser = async () => {
    const firebaseUid = `test-${crypto.randomUUID()}`;
    sessionId = crypto.randomUUID();

    const result = await pool.query(
      `
      INSERT INTO users (firebase_uid, email, display_name)
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [firebaseUid, `${firebaseUid}@example.com`, "Integration Test User"],
    );

    userId = result.rows[0].id;

    await redis.set(
      `session:${sessionId}`,
      JSON.stringify({
        id: userId,
        email: `${firebaseUid}@example.com`,
      }),
      "EX",
      600,
    );
  };

  const removeMediaFiles = async () => {
    const result = await pool.query(
      `
      SELECT id, storage_key, thumbnail_key
      FROM media_files
      WHERE user_id = $1
      `,
      [userId],
    );

    for (const media of result.rows) {
      const job = await mediaProcessingQueue.getJob(media.id);

      if (job) {
        const state = await job.getState();

        if (state !== "active") {
          await job.remove().catch(() => undefined);
        }
      }

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

    await pool.query("DELETE FROM media_files WHERE user_id = $1", [userId]);
  };

  beforeAll(async () => {
    const dbResult = await pool.query("SELECT current_database() AS name");

    if (dbResult.rows[0].name !== "memora_ai_test") {
      throw new Error(
        `Unsafe test database: ${dbResult.rows[0].name}. Expected memora_ai_test.`,
      );
    }

    const redisUrl = new URL(env.REDIS_URL!);

    if (redisUrl.pathname !== "/1") {
      throw new Error(
        `Unsafe Redis database: ${redisUrl.pathname}. Expected /1.`,
      );
    }

    await redis.ping();
    await bullmqRedis.ping();
    await mediaProcessingQueue.waitUntilReady();

    await fs.mkdir(mediaStorageDir, { recursive: true });
    await fs.mkdir(mediaThumbnailDir, { recursive: true });
  });

  beforeEach(async () => {
    await createSessionUser();
  });

  afterEach(async () => {
    // Restore spies before cleanup because cleanup uses the real queue/filesystem.
    vi.restoreAllMocks();

    await removeMediaFiles();

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    await redis.del(`session:${sessionId}`);
  });

  afterAll(async () => {
    // This suite does not own the worker or shared connection lifecycle.
  });

  // ==================================================
  // RECOVERY: UNQUEUED MEDIA
  // ==================================================

  describe("recoverUnqueuedMediaJobs()", () => {
    it("recreates a job when uploaded media has no BullMQ job", async () => {
      const media = await createMediaRecord({
        processingStatus: "uploaded",
      });

      expect(await mediaProcessingQueue.getJob(media.id)).toBeUndefined();

      await recoverUnqueuedMediaJobs();

      const job = await mediaProcessingQueue.getJob(media.id);

      expect(job).toBeDefined();
      expect(job?.name).toBe("process-image");

      expect(job?.data).toMatchObject({
        mediaId: media.id,
        userId,
        storageKey: media.storage_key,
      });
    });

    it("does not create a duplicate when a waiting job already exists", async () => {
      const media = await createMediaRecord({
        processingStatus: "uploaded",
      });

      await mediaProcessingQueue.add(
        "process-image",
        {
          mediaId: media.id,
          userId,
          storageKey: media.storage_key,
        },
        { jobId: media.id },
      );

      const existingJob = await mediaProcessingQueue.getJob(media.id);

      expect(existingJob).toBeDefined();
      expect(await existingJob!.getState()).toBe("waiting");

      await recoverUnqueuedMediaJobs();

      const jobAfterRecovery = await mediaProcessingQueue.getJob(media.id);

      expect(jobAfterRecovery).toBeDefined();
      expect(jobAfterRecovery?.id).toBe(media.id);
      expect(await jobAfterRecovery!.getState()).toBe("waiting");
    });

    it("recovers multiple unqueued media records in one run", async () => {
      const mediaRecords = [];

      for (let index = 0; index < 10; index++) {
        const media = await createMediaRecord({
          processingStatus: "uploaded",
        });

        mediaRecords.push(media);
      }

      await recoverUnqueuedMediaJobs();

      for (const media of mediaRecords) {
        const job = await mediaProcessingQueue.getJob(media.id);

        expect(job).toBeDefined();
        expect(job?.data).toMatchObject({
          mediaId: media.id,
          userId,
          storageKey: media.storage_key,
        });
      }
    });
  });

  // ==================================================
  // RECOVERY: STUCK PROCESSING MEDIA
  // ==================================================

  describe("recoverStuckProcessingJobs()", () => {
    it("recovers a processing record with NULL processing_started_at", async () => {
      const media = await createMediaRecord({
        processingStatus: "processing",
        processingStartedAt: null,
      });

      await recoverStuckProcessingJobs();

      const job = await mediaProcessingQueue.getJob(media.id);

      expect(job).toBeDefined();

      expect(job?.data).toMatchObject({
        mediaId: media.id,
        userId,
        storageKey: media.storage_key,
      });
    });

    it("recovers a processing record older than five minutes", async () => {
      const media = await createMediaRecord({
        processingStatus: "processing",
      });

      await makeMediaStale(media.id);

      await recoverStuckProcessingJobs();

      const job = await mediaProcessingQueue.getJob(media.id);

      expect(job).toBeDefined();
      expect(job?.data.mediaId).toBe(media.id);
    });

    it("does not recreate an existing waiting job for stale media", async () => {
      const media = await createMediaRecord({
        processingStatus: "processing",
      });

      await makeMediaStale(media.id);

      await mediaProcessingQueue.add(
        "process-image",
        {
          mediaId: media.id,
          userId,
          storageKey: media.storage_key,
        },
        { jobId: media.id },
      );

      const existingJob = await mediaProcessingQueue.getJob(media.id);

      expect(await existingJob!.getState()).toBe("waiting");

      await recoverStuckProcessingJobs();

      const jobAfterRecovery = await mediaProcessingQueue.getJob(media.id);

      expect(jobAfterRecovery).toBeDefined();
      expect(jobAfterRecovery?.id).toBe(media.id);
      expect(await jobAfterRecovery!.getState()).toBe("waiting");
    });

    it.each(["active", "delayed"] as const)(
      "does not recreate an existing %s job",
      async (existingState) => {
        const media = await createMediaRecord({
          processingStatus: "processing",
        });

        await makeMediaStale(media.id);

        // Simulate BullMQ returning an existing job in this state.
        // This isolates the recovery helper's state-handling behavior.
        const fakeJob = {
          getState: vi.fn().mockResolvedValue(existingState),
        };

        const getJobSpy = vi
          .spyOn(mediaProcessingQueue, "getJob")
          .mockResolvedValue(fakeJob as any);

        const addSpy = vi.spyOn(mediaProcessingQueue, "add");

        await recoverStuckProcessingJobs();

        expect(getJobSpy).toHaveBeenCalledWith(media.id);
        expect(addSpy).not.toHaveBeenCalled();
      },
    );

    it("marks PostgreSQL as failed when the existing BullMQ job has permanently failed", async () => {
      const media = await createMediaRecord({
        processingStatus: "processing",
      });

      await makeMediaStale(media.id);

      const fakeJob = {
        getState: vi.fn().mockResolvedValue("failed"),
      };

      vi.spyOn(mediaProcessingQueue, "getJob").mockResolvedValue(
        fakeJob as any,
      );

      const addSpy = vi.spyOn(mediaProcessingQueue, "add");

      await recoverStuckProcessingJobs();

      expect(addSpy).not.toHaveBeenCalled();

      const result = await pool.query(
        `
        SELECT processing_status, processing_started_at
        FROM media_files
        WHERE id = $1 AND user_id = $2
        `,
        [media.id, userId],
      );

      expect(result.rowCount).toBe(1);
      expect(result.rows[0].processing_status).toBe("failed");
      expect(result.rows[0].processing_started_at).toBeNull();
    });

    it("does not mark media completed when BullMQ is completed but PostgreSQL is still processing", async () => {
      const media = await createMediaRecord({
        processingStatus: "processing",
      });

      await makeMediaStale(media.id);

      const fakeJob = {
        getState: vi.fn().mockResolvedValue("completed"),
      };

      vi.spyOn(mediaProcessingQueue, "getJob").mockResolvedValue(
        fakeJob as any,
      );

      const addSpy = vi.spyOn(mediaProcessingQueue, "add");

      await recoverStuckProcessingJobs();

      expect(addSpy).not.toHaveBeenCalled();

      const result = await pool.query(
        `
        SELECT processing_status
        FROM media_files
        WHERE id = $1 AND user_id = $2
        `,
        [media.id, userId],
      );

      // Current helper logs this inconsistency but does not reconcile it.
      expect(result.rows[0].processing_status).toBe("processing");
    });
  });

  // ==================================================
  // DELETE API
  // ==================================================

  describe("DELETE /api/v1/media/:id", () => {
    it("deletes the database record, original image, and thumbnail", async () => {
      const originalKey = `${crypto.randomUUID()}.png`;
      const thumbnailKey = `${crypto.randomUUID()}.webp`;

      const media = await createMediaRecord({
        storageKey: originalKey,
        thumbnailKey,
        processingStatus: "completed",
      });

      await fs.writeFile(
        path.join(mediaStorageDir, originalKey),
        await createPng(),
      );

      await fs.writeFile(
        path.join(mediaThumbnailDir, thumbnailKey),
        Buffer.from("thumbnail"),
      );

      const response = await request(app)
        .delete(`/api/v1/media/${media.id}`)
        .set("Cookie", `session=${sessionId}`);

      expect(response.status).toBe(200);

      expect(response.body).toMatchObject({
        success: true,
        metadataDeleted: true,
        originalDeleted: true,
        thumbnailDeleted: true,
        cleanupComplete: true,
      });

      const dbResult = await pool.query(
        "SELECT id FROM media_files WHERE id = $1",
        [media.id],
      );

      expect(dbResult.rowCount).toBe(0);

      await expect(
        fs.access(path.join(mediaStorageDir, originalKey)),
      ).rejects.toThrow();

      await expect(
        fs.access(path.join(mediaThumbnailDir, thumbnailKey)),
      ).rejects.toThrow();
    });

    it("returns 401 when the user is not authenticated", async () => {
      const media = await createMediaRecord();

      const response = await request(app).delete(`/api/v1/media/${media.id}`);

      expect(response.status).toBe(401);

      const result = await pool.query(
        "SELECT id FROM media_files WHERE id = $1",
        [media.id],
      );

      expect(result.rowCount).toBe(1);
    });

    it("returns 404 when the media record does not exist", async () => {
      const response = await request(app)
        .delete(`/api/v1/media/${crypto.randomUUID()}`)
        .set("Cookie", `session=${sessionId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Image not found.");
    });

    it("does not allow one user to delete another user's media", async () => {
      const otherFirebaseUid = `other-${crypto.randomUUID()}`;

      const otherUserResult = await pool.query(
        `
        INSERT INTO users (firebase_uid, email, display_name)
        VALUES ($1, $2, $3)
        RETURNING id
        `,
        [otherFirebaseUid, `${otherFirebaseUid}@example.com`, "Another User"],
      );

      const otherUserId = otherUserResult.rows[0].id;
      const mediaId = crypto.randomUUID();
      const storageKey = `${mediaId}.png`;

      await pool.query(
        `
        INSERT INTO media_files (
          id,
          user_id,
          filename,
          storage_key,
          mime_type,
          file_size,
          status,
          processing_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          mediaId,
          otherUserId,
          storageKey,
          storageKey,
          "image/png",
          1000,
          "uploaded",
          "uploaded",
        ],
      );

      await fs.writeFile(
        path.join(mediaStorageDir, storageKey),
        await createPng(),
      );

      const response = await request(app)
        .delete(`/api/v1/media/${mediaId}`)
        .set("Cookie", `session=${sessionId}`);

      expect(response.status).toBe(404);

      const dbResult = await pool.query(
        "SELECT id FROM media_files WHERE id = $1",
        [mediaId],
      );

      expect(dbResult.rowCount).toBe(1);

      await fs.rm(path.join(mediaStorageDir, storageKey), { force: true });

      await pool.query("DELETE FROM users WHERE id = $1", [otherUserId]);
    });

    it("treats a missing original file as successfully cleaned up", async () => {
      const originalKey = `${crypto.randomUUID()}.png`;
      const thumbnailKey = `${crypto.randomUUID()}.webp`;

      const media = await createMediaRecord({
        storageKey: originalKey,
        thumbnailKey,
        processingStatus: "completed",
      });

      // Original deliberately does not exist.
      await fs.writeFile(
        path.join(mediaThumbnailDir, thumbnailKey),
        Buffer.from("thumbnail"),
      );

      const response = await request(app)
        .delete(`/api/v1/media/${media.id}`)
        .set("Cookie", `session=${sessionId}`);

      expect(response.status).toBe(200);

      expect(response.body).toMatchObject({
        success: true,
        originalDeleted: true,
        thumbnailDeleted: true,
        cleanupComplete: true,
      });

      await expect(
        fs.access(path.join(mediaThumbnailDir, thumbnailKey)),
      ).rejects.toThrow();
    });

    it("treats a missing thumbnail file as successfully cleaned up", async () => {
      const originalKey = `${crypto.randomUUID()}.png`;
      const thumbnailKey = `${crypto.randomUUID()}.webp`;

      const media = await createMediaRecord({
        storageKey: originalKey,
        thumbnailKey,
        processingStatus: "completed",
      });

      await fs.writeFile(
        path.join(mediaStorageDir, originalKey),
        await createPng(),
      );

      // Thumbnail deliberately does not exist.

      const response = await request(app)
        .delete(`/api/v1/media/${media.id}`)
        .set("Cookie", `session=${sessionId}`);

      expect(response.status).toBe(200);

      expect(response.body).toMatchObject({
        success: true,
        originalDeleted: true,
        thumbnailDeleted: true,
        cleanupComplete: true,
      });

      await expect(
        fs.access(path.join(mediaStorageDir, originalKey)),
      ).rejects.toThrow();
    });

    it("rejects unsafe original storage paths and preserves the database record", async () => {
      const media = await createMediaRecord({
        storageKey: "../outside.png",
      });

      const response = await request(app)
        .delete(`/api/v1/media/${media.id}`)
        .set("Cookie", `session=${sessionId}`);

      expect(response.status).toBe(400);

      expect(response.body).toMatchObject({
        success: false,
        message: "Invalid file path.",
      });

      const dbResult = await pool.query(
        "SELECT id FROM media_files WHERE id = $1",
        [media.id],
      );

      expect(dbResult.rowCount).toBe(1);
    });

    it("rejects unsafe thumbnail paths and preserves the database record", async () => {
      const media = await createMediaRecord({
        thumbnailKey: "../outside.webp",
      });

      const response = await request(app)
        .delete(`/api/v1/media/${media.id}`)
        .set("Cookie", `session=${sessionId}`);

      expect(response.status).toBe(400);

      expect(response.body).toMatchObject({
        success: false,
        message: "Invalid file path.",
      });

      const dbResult = await pool.query(
        "SELECT id FROM media_files WHERE id = $1",
        [media.id],
      );

      expect(dbResult.rowCount).toBe(1);
    });

    it("reports partial cleanup when deleting the original file fails", async () => {
      const originalKey = `${crypto.randomUUID()}.png`;
      const thumbnailKey = `${crypto.randomUUID()}.webp`;

      const media = await createMediaRecord({
        storageKey: originalKey,
        thumbnailKey,
        processingStatus: "completed",
      });

      await fs.writeFile(
        path.join(mediaStorageDir, originalKey),
        await createPng(),
      );

      await fs.writeFile(
        path.join(mediaThumbnailDir, thumbnailKey),
        Buffer.from("thumbnail"),
      );

      const originalUnlink = fs.unlink.bind(fs);

      const unlinkSpy = vi
        .spyOn(fs, "unlink")
        .mockImplementation(async (filePath) => {
          if (String(filePath) === path.join(mediaStorageDir, originalKey)) {
            const error = Object.assign(
              new Error("Simulated permission error"),
              { code: "EACCES" },
            );

            throw error;
          }

          return originalUnlink(filePath);
        });

      const response = await request(app)
        .delete(`/api/v1/media/${media.id}`)
        .set("Cookie", `session=${sessionId}`);

      expect(unlinkSpy).toHaveBeenCalled();
      expect(response.status).toBe(200);

      expect(response.body).toMatchObject({
        success: true,
        metadataDeleted: true,
        originalDeleted: false,
        thumbnailDeleted: true,
        cleanupComplete: false,
      });

      const dbResult = await pool.query(
        "SELECT id FROM media_files WHERE id = $1",
        [media.id],
      );

      expect(dbResult.rowCount).toBe(0);

      unlinkSpy.mockRestore();

      await fs.rm(path.join(mediaStorageDir, originalKey), { force: true });
    });
  });
});
