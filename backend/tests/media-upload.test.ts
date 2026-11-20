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
import { mediaStorageDir, mediaThumbnailDir } from "../config/media-storage.js";
import { env } from "../lib/env.js";

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
    const firebaseUid = `test-${crypto.randomUUID()}`;
    sessionId = crypto.randomUUID();

    const result = await pool.query(
      `INSERT INTO users (firebase_uid, email, display_name)
       VALUES ($1, $2, $3)
       RETURNING id`,
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

  afterEach(async () => {
    const result = await pool.query(
      `SELECT id, storage_key, thumbnail_key
       FROM media_files
       WHERE user_id = $1`,
      [userId],
    );

    for (const media of result.rows) {
      const job = await mediaProcessingQueue.getJob(media.id);
      if (job) await job.remove();

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

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    await redis.del(`session:${sessionId}`);

    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await mediaProcessingQueue.close();
    await bullmqRedis.quit();
    await redis.quit();
    await pool.end();
  });

  // --------------------------------------------------
  // TEST 1: Single image upload
  // --------------------------------------------------

  it("uploads an image, saves metadata, and queues processing", async () => {
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
    expect(response.body.processingQueued).toBe(true);

    const uploadedImage = response.body.image;

    expect(uploadedImage).toBeDefined();
    expect(uploadedImage.id).toBeDefined();
    expect(uploadedImage.storage_key).toBeDefined();

    await expect(
      fs.access(path.join(mediaStorageDir, uploadedImage.storage_key)),
    ).resolves.toBeUndefined();

    const dbResult = await pool.query(
      `SELECT id, user_id, storage_key, processing_status
       FROM media_files
       WHERE id = $1 AND user_id = $2`,
      [uploadedImage.id, userId],
    );

    expect(dbResult.rowCount).toBe(1);
    expect(dbResult.rows[0].storage_key).toBe(uploadedImage.storage_key);
    expect(dbResult.rows[0].processing_status).toBe("uploaded");

    const job = await mediaProcessingQueue.getJob(uploadedImage.id);

    expect(job).toBeDefined();
    expect(job?.data).toMatchObject({
      mediaId: uploadedImage.id,
      userId,
      storageKey: uploadedImage.storage_key,
    });
  });

  // --------------------------------------------------
  // TEST 2: Multiple image upload
  // --------------------------------------------------

  it("uploads multiple images and queues their processing jobs", async () => {
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
    expect(response.body.processingQueued).toBe(true);

    const uploadedImages = response.body.images;

    expect(uploadedImages).toHaveLength(2);

    for (const image of uploadedImages) {
      expect(image.id).toBeDefined();

      await expect(
        fs.access(path.join(mediaStorageDir, image.storage_key)),
      ).resolves.toBeUndefined();

      const dbResult = await pool.query(
        `SELECT id, processing_status
         FROM media_files
         WHERE id = $1 AND user_id = $2`,
        [image.id, userId],
      );

      expect(dbResult.rowCount).toBe(1);
      expect(dbResult.rows[0].processing_status).toBe("uploaded");

      const job = await mediaProcessingQueue.getJob(image.id);
      expect(job).toBeDefined();
    }
  });

  // --------------------------------------------------
  // TEST 3: Invalid file type
  // --------------------------------------------------

  it("rejects files with unsupported MIME types", async () => {
    const response = await request(app)
      .post("/api/v1/media/upload/single")
      .set("Cookie", `session=${sessionId}`)
      .attach("image", Buffer.from("This is not an image"), {
        filename: "document.txt",
        contentType: "text/plain",
      });

    // Unsupported MIME type
    expect(response.status).toBe(400);

    const dbResult = await pool.query(
      "SELECT id FROM media_files WHERE user_id = $1",
      [userId],
    );

    expect(dbResult.rowCount).toBe(0);
  });

  // --------------------------------------------------
  // TEST 4: File size limit
  // --------------------------------------------------

  it("rejects images larger than 20 MB", async () => {
    const largeBuffer = Buffer.alloc(20 * 1024 * 1024 + 1);

    const response = await request(app)
      .post("/api/v1/media/upload/single")
      .set("Cookie", `session=${sessionId}`)
      .attach("image", largeBuffer, {
        filename: "large-image.png",
        contentType: "image/png",
      });

    // File larger than 20 MB
    expect(response.status).toBe(413);

    const dbResult = await pool.query(
      "SELECT id FROM media_files WHERE user_id = $1",
      [userId],
    );

    expect(dbResult.rowCount).toBe(0);
  });

  // --------------------------------------------------
  // TEST 5: Authentication required
  // --------------------------------------------------

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

  // --------------------------------------------------
  // TEST 6: Queue unavailable
  // --------------------------------------------------

  it("preserves the uploaded image when queue enqueue fails", async () => {
    const pngBuffer = await createPng();

    // Simulate BullMQ enqueue failure.
    const addBulkSpy = vi
      .spyOn(mediaProcessingQueue, "addBulk")
      .mockRejectedValueOnce(new Error("Simulated Redis queue failure"));

    const response = await request(app)
      .post("/api/v1/media/upload/single")
      .set("Cookie", `session=${sessionId}`)
      .attach("image", pngBuffer, {
        filename: "queue-failure.png",
        contentType: "image/png",
      });

    expect(addBulkSpy).toHaveBeenCalled();

    // Upload should still succeed.
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.processingQueued).toBe(false);

    const uploadedImage = response.body.image;

    expect(uploadedImage).toBeDefined();

    // Original file must be preserved.
    await expect(
      fs.access(path.join(mediaStorageDir, uploadedImage.storage_key)),
    ).resolves.toBeUndefined();

    // PostgreSQL record must also be preserved.
    const dbResult = await pool.query(
      `SELECT id, processing_status
       FROM media_files
       WHERE id = $1 AND user_id = $2`,
      [uploadedImage.id, userId],
    );

    expect(dbResult.rowCount).toBe(1);
    expect(dbResult.rows[0].processing_status).toBe("uploaded");
  });
});
