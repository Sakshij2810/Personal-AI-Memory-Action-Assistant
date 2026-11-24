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
import imageAnalysisQueue from "../queues/analysis.queue.js";

import { mediaStorageDir, mediaThumbnailDir } from "../config/media-storage.js";

import { env } from "../lib/env.js";
import { faceQueue } from "../queues/face.queue.js";

describe("Media upload integration tests", () => {
  let userId: string;
  let sessionId: string;

  const createPng = async () =>
    sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

  // ==================================================
  // QUEUE CLEANUP HELPER
  // ==================================================

  const removeJobIfNotActive = async (
    queue:
      | typeof mediaProcessingQueue
      | typeof imageAnalysisQueue
      | typeof faceQueue,
    jobId: string,
  ) => {
    const job = await queue.getJob(jobId);

    if (!job) return;

    try {
      const state = await job.getState();

      if (state !== "active") {
        await job.remove();
      }
    } catch {
      // Ignore jobs that are no longer removable.
    }
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

    await mediaProcessingQueue.waitUntilReady();
    await imageAnalysisQueue.waitUntilReady();
    await faceQueue.waitUntilReady();

    await fs.mkdir(mediaStorageDir, { recursive: true });
    await fs.mkdir(mediaThumbnailDir, { recursive: true });
  });

  // ==================================================
  // TEST DATA SETUP
  // ==================================================

  beforeEach(async () => {
    const firebaseUid = `test-${crypto.randomUUID()}`;

    sessionId = crypto.randomUUID();

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
  });

  // ==================================================
  // CLEANUP
  // ==================================================

  afterEach(async () => {
    // Restore spies before cleanup so real queue methods are used.
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
      // Remove media-processing job.
      await removeJobIfNotActive(mediaProcessingQueue, media.id);

      // Remove independent image-analysis job.
      await removeJobIfNotActive(imageAnalysisQueue, `analysis-${media.id}`);

      // Remove independent face-processing job.
      await removeJobIfNotActive(faceQueue, `face-${media.id}`);

      // Remove original image.
      if (media.storage_key) {
        await fs.rm(path.join(mediaStorageDir, media.storage_key), {
          force: true,
        });
      }

      // Remove generated thumbnail.
      if (media.thumbnail_key) {
        await fs.rm(path.join(mediaThumbnailDir, media.thumbnail_key), {
          force: true,
        });
      }
    }

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    await redis.del(`session:${sessionId}`);
  });

  afterAll(async () => {
    await mediaProcessingQueue.close();
    await imageAnalysisQueue.close();
    await faceQueue.close();

    await bullmqRedis.quit();
    await redis.quit();

    await pool.end();
  });

  // ==================================================
  // TEST 1: SINGLE IMAGE UPLOAD
  // ==================================================

  it("uploads an image and independently queues media processing, image analysis, and face processing", async () => {
    const pngBuffer = await createPng();

    const response = await request(app)
      .post("/api/v1/media/upload/single")
      .set("Cookie", `session=${sessionId}`)
      .attach("image", pngBuffer, {
        filename: "test-image.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    expect(response.body.processing).toEqual({
      mediaQueued: true,
      analysisQueued: true,
      faceQueued: true,
    });

    expect(response.body.processingQueued).toBe(true);

    const uploadedImage = response.body.image;

    expect(uploadedImage).toBeDefined();
    expect(uploadedImage.id).toBeDefined();
    expect(uploadedImage.storage_key).toBeDefined();

    // Verify original image exists.
    await expect(
      fs.access(path.join(mediaStorageDir, uploadedImage.storage_key)),
    ).resolves.toBeUndefined();

    // Verify PostgreSQL metadata.
    const dbResult = await pool.query(
      `
        SELECT
          id,
          user_id,
          storage_key,
          processing_status
        FROM media_files
        WHERE id = $1 AND user_id = $2
        `,
      [uploadedImage.id, userId],
    );

    expect(dbResult.rowCount).toBe(1);

    expect(dbResult.rows[0].storage_key).toBe(uploadedImage.storage_key);

    expect(dbResult.rows[0].processing_status).toBe("uploaded");

    // Verify media-processing job.
    const mediaJob = await mediaProcessingQueue.getJob(uploadedImage.id);

    expect(mediaJob).toBeDefined();
    expect(mediaJob?.name).toBe("process-image");

    expect(mediaJob?.data).toMatchObject({
      mediaId: uploadedImage.id,
      userId,
      storageKey: uploadedImage.storage_key,
    });

    // Verify independent image-analysis job.
    const analysisJob = await imageAnalysisQueue.getJob(
      `analysis-${uploadedImage.id}`,
    );

    expect(analysisJob).toBeDefined();
    expect(analysisJob?.name).toBe("analyze-image");

    expect(analysisJob?.data).toMatchObject({
      mediaId: uploadedImage.id,
      userId,
    });

    // Verify independent face-processing job.
    const faceJob = await faceQueue.getJob(`face-${uploadedImage.id}`);

    expect(faceJob).toBeDefined();

    expect(faceJob?.data).toMatchObject({
      mediaId: uploadedImage.id,
      userId,
    });
  });

  // ==================================================
  // TEST 2: MULTIPLE IMAGE UPLOAD
  // ==================================================

  it("uploads multiple images and queues all three jobs for every image", async () => {
    const image1 = await createPng();
    const image2 = await createPng();

    const response = await request(app)
      .post("/api/v1/media/upload/multiple")
      .set("Cookie", `session=${sessionId}`)
      .attach("images", image1, {
        filename: "image-1.png",
        contentType: "image/png",
      })
      .attach("images", image2, {
        filename: "image-2.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    expect(response.body.processing).toEqual({
      mediaQueued: true,
      analysisQueued: true,
      faceQueued: true,
      mediaJobsQueued: 2,
      analysisJobsQueued: 2,
      faceJobsQueued: 2,
    });

    expect(response.body.processingQueued).toBe(true);

    const uploadedImages = response.body.images;

    expect(uploadedImages).toHaveLength(2);

    for (const image of uploadedImages) {
      expect(image.id).toBeDefined();

      // Verify original file.
      await expect(
        fs.access(path.join(mediaStorageDir, image.storage_key)),
      ).resolves.toBeUndefined();

      // Verify database record.
      const dbResult = await pool.query(
        `
          SELECT id, processing_status
          FROM media_files
          WHERE id = $1 AND user_id = $2
          `,
        [image.id, userId],
      );

      expect(dbResult.rowCount).toBe(1);
      expect(dbResult.rows[0].processing_status).toBe("uploaded");

      // Verify media-processing job.
      const mediaJob = await mediaProcessingQueue.getJob(image.id);

      expect(mediaJob).toBeDefined();

      expect(mediaJob?.data).toMatchObject({
        mediaId: image.id,
        userId,
        storageKey: image.storage_key,
      });

      // Verify image-analysis job.
      const analysisJob = await imageAnalysisQueue.getJob(
        `analysis-${image.id}`,
      );

      expect(analysisJob).toBeDefined();

      expect(analysisJob?.data).toMatchObject({
        mediaId: image.id,
        userId,
      });

      // Verify face-processing job.
      const faceJob = await faceQueue.getJob(`face-${image.id}`);

      expect(faceJob).toBeDefined();

      expect(faceJob?.data).toMatchObject({
        mediaId: image.id,
        userId,
      });
    }
  });

  // ==================================================
  // TEST 3: INVALID FILE TYPE
  // ==================================================

  it("rejects files with unsupported MIME types", async () => {
    const response = await request(app)
      .post("/api/v1/media/upload/single")
      .set("Cookie", `session=${sessionId}`)
      .attach("image", Buffer.from("This is not an image"), {
        filename: "document.txt",
        contentType: "text/plain",
      });

    expect(response.status).toBe(400);

    const dbResult = await pool.query(
      "SELECT id FROM media_files WHERE user_id = $1",
      [userId],
    );

    expect(dbResult.rowCount).toBe(0);
  });

  // ==================================================
  // TEST 4: FILE SIZE LIMIT
  // ==================================================

  it("rejects images larger than 20 MB", async () => {
    const largeBuffer = Buffer.alloc(20 * 1024 * 1024 + 1);

    const response = await request(app)
      .post("/api/v1/media/upload/single")
      .set("Cookie", `session=${sessionId}`)
      .attach("image", largeBuffer, {
        filename: "large-image.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(413);

    const dbResult = await pool.query(
      "SELECT id FROM media_files WHERE user_id = $1",
      [userId],
    );

    expect(dbResult.rowCount).toBe(0);
  });

  // ==================================================
  // TEST 5: AUTHENTICATION REQUIRED
  // ==================================================

  it("rejects uploads without authentication", async () => {
    const pngBuffer = await createPng();

    const response = await request(app)
      .post("/api/v1/media/upload/single")
      .attach("image", pngBuffer, {
        filename: "unauthorized.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(401);

    const dbResult = await pool.query(
      "SELECT id FROM media_files WHERE user_id = $1",
      [userId],
    );

    expect(dbResult.rowCount).toBe(0);
  });

  // ==================================================
  // TEST 6: MEDIA QUEUE ENQUEUE FAILURE
  // ==================================================

  it("preserves the upload and independently queues image analysis and face processing when media-processing enqueue fails", async () => {
    const pngBuffer = await createPng();

    // Simulate media-processing queue failure.
    const addBulkSpy = vi
      .spyOn(mediaProcessingQueue, "addBulk")
      .mockRejectedValueOnce(new Error("Simulated media queue failure"));

    const response = await request(app)
      .post("/api/v1/media/upload/single")
      .set("Cookie", `session=${sessionId}`)
      .attach("image", pngBuffer, {
        filename: "media-queue-failure.png",
        contentType: "image/png",
      });

    expect(addBulkSpy).toHaveBeenCalled();

    // Upload should still succeed.
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    expect(response.body.processing).toEqual({
      mediaQueued: false,
      analysisQueued: true,
      faceQueued: true,
    });

    expect(response.body.processingQueued).toBe(false);

    const uploadedImage = response.body.image;

    expect(uploadedImage).toBeDefined();

    // Original image must be preserved.
    await expect(
      fs.access(path.join(mediaStorageDir, uploadedImage.storage_key)),
    ).resolves.toBeUndefined();

    // Database record must be preserved.
    const dbResult = await pool.query(
      `
        SELECT id, processing_status
        FROM media_files
        WHERE id = $1 AND user_id = $2
        `,
      [uploadedImage.id, userId],
    );

    expect(dbResult.rowCount).toBe(1);
    expect(dbResult.rows[0].processing_status).toBe("uploaded");

    // Analysis job must still be queued independently.
    const analysisJob = await imageAnalysisQueue.getJob(
      `analysis-${uploadedImage.id}`,
    );

    expect(analysisJob).toBeDefined();

    expect(analysisJob?.data).toMatchObject({
      mediaId: uploadedImage.id,
      userId,
    });

    // Face job must still be queued independently.
    const faceJob = await faceQueue.getJob(`face-${uploadedImage.id}`);

    expect(faceJob).toBeDefined();

    expect(faceJob?.data).toMatchObject({
      mediaId: uploadedImage.id,
      userId,
    });

    // Media job should not exist because enqueue failed.
    const mediaJob = await mediaProcessingQueue.getJob(uploadedImage.id);

    expect(mediaJob).toBeUndefined();
  });

  // ==================================================
  // TEST 7: ANALYSIS QUEUE ENQUEUE FAILURE
  // ==================================================

  it("preserves the upload and independently queues media processing and face processing when image-analysis enqueue fails", async () => {
    const pngBuffer = await createPng();

    // Simulate image-analysis queue failure.
    const addBulkSpy = vi
      .spyOn(imageAnalysisQueue, "addBulk")
      .mockRejectedValueOnce(new Error("Simulated analysis queue failure"));

    const response = await request(app)
      .post("/api/v1/media/upload/single")
      .set("Cookie", `session=${sessionId}`)
      .attach("image", pngBuffer, {
        filename: "analysis-queue-failure.png",
        contentType: "image/png",
      });

    expect(addBulkSpy).toHaveBeenCalled();

    // Upload should still succeed.
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    expect(response.body.processing).toEqual({
      mediaQueued: true,
      analysisQueued: false,
      faceQueued: true,
    });

    expect(response.body.processingQueued).toBe(false);

    const uploadedImage = response.body.image;

    expect(uploadedImage).toBeDefined();

    // Original image must be preserved.
    await expect(
      fs.access(path.join(mediaStorageDir, uploadedImage.storage_key)),
    ).resolves.toBeUndefined();

    // Database record must be preserved.
    const dbResult = await pool.query(
      `
        SELECT id, processing_status
        FROM media_files
        WHERE id = $1 AND user_id = $2
        `,
      [uploadedImage.id, userId],
    );

    expect(dbResult.rowCount).toBe(1);
    expect(dbResult.rows[0].processing_status).toBe("uploaded");

    // Media-processing job must still be queued independently.
    const mediaJob = await mediaProcessingQueue.getJob(uploadedImage.id);

    expect(mediaJob).toBeDefined();

    expect(mediaJob?.data).toMatchObject({
      mediaId: uploadedImage.id,
      userId,
      storageKey: uploadedImage.storage_key,
    });

    // Face-processing job must still be queued independently.
    const faceJob = await faceQueue.getJob(`face-${uploadedImage.id}`);

    expect(faceJob).toBeDefined();

    expect(faceJob?.data).toMatchObject({
      mediaId: uploadedImage.id,
      userId,
    });

    // Analysis job should not exist because enqueue failed.
    const analysisJob = await imageAnalysisQueue.getJob(
      `analysis-${uploadedImage.id}`,
    );

    expect(analysisJob).toBeUndefined();
  });
});
