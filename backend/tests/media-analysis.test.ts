// backend/tests/media-analysis.test.ts

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import request from "supertest";
import crypto from "node:crypto";

import app from "../app.js";
import pool from "../config/db.js";
import redis from "../shared/redis/redis.js";
import bullmqRedis from "../shared/redis/bullmq-connection.js";

import { env } from "../lib/env.js";

import {
  createAnalysisRecord,
  updateAnalysisStatus,
  updateAnalysisResult,
} from "../services/ai/analysis.repository.js";

describe("GET /api/v1/media/:id/analysis integration tests", () => {
  let userId: string;
  let sessionId: string;

  // ==================================================
  // TEST DATA HELPERS
  // ==================================================

  const createSessionUser = async () => {
    const firebaseUid = `media-analysis-${crypto.randomUUID()}`;
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
      [firebaseUid, `${firebaseUid}@example.com`, "Media Analysis Test User"],
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

  const createMediaRecord = async (
    ownerId: string = userId,
    processingStatus: string = "completed",
  ) => {
    const storageKey = `${crypto.randomUUID()}.jpg`;

    const result = await pool.query(
      `
      INSERT INTO media_files (
        user_id,
        filename,
        storage_key,
        mime_type,
        file_size,
        status,
        processing_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
      `,
      [
        ownerId,
        "analysis-test.jpg",
        storageKey,
        "image/jpeg",
        1024,
        "uploaded",
        processingStatus,
      ],
    );

    return result.rows[0].id as string;
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
  });

  // ==================================================
  // SETUP
  // ==================================================

  beforeEach(async () => {
    await createSessionUser();
  });

  // ==================================================
  // CLEANUP
  // ==================================================

  afterEach(async () => {
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    await redis.del(`session:${sessionId}`);
  });

  // ==================================================
  // TEST 1: AUTHENTICATION REQUIRED
  // ==================================================

  it("returns 401 when the user is not authenticated", async () => {
    const response = await request(app).get(
      `/api/v1/media/${crypto.randomUUID()}/analysis`,
    );

    expect(response.status).toBe(401);

    expect(response.body).toMatchObject({
      message: "Unauthorised",
    });
  });

  // ==================================================
  // TEST 2: MEDIA NOT FOUND
  // ==================================================

  it("returns 404 when the media does not exist", async () => {
    const response = await request(app)
      .get(`/api/v1/media/${crypto.randomUUID()}/analysis`)
      .set("Cookie", `session=${sessionId}`);

    expect(response.status).toBe(404);

    expect(response.body).toMatchObject({
      success: false,
      message: "Image not found.",
    });
  });

  // ==================================================
  // TEST 3: MEDIA OWNERSHIP
  // ==================================================

  it("does not allow a user to access another user's analysis", async () => {
    const otherFirebaseUid = `other-${crypto.randomUUID()}`;

    const otherUserResult = await pool.query(
      `
      INSERT INTO users (
        firebase_uid,
        email,
        display_name
      )
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [otherFirebaseUid, `${otherFirebaseUid}@example.com`, "Another User"],
    );

    const otherUserId = otherUserResult.rows[0].id;

    try {
      const mediaId = await createMediaRecord(otherUserId);

      await createAnalysisRecord(mediaId, "gemini", "gemini-3.5-flash-lite");

      const response = await request(app)
        .get(`/api/v1/media/${mediaId}/analysis`)
        .set("Cookie", `session=${sessionId}`);

      expect(response.status).toBe(404);

      expect(response.body).toMatchObject({
        success: false,
        message: "Image not found.",
      });
    } finally {
      await pool.query("DELETE FROM users WHERE id = $1", [otherUserId]);
    }
  });

  // ==================================================
  // TEST 4: DEFAULT PENDING RESPONSE
  // ==================================================

  it("returns pending analysis when no analysis record exists yet", async () => {
    const mediaId = await createMediaRecord();

    const response = await request(app)
      .get(`/api/v1/media/${mediaId}/analysis`)
      .set("Cookie", `session=${sessionId}`);

    expect(response.status).toBe(200);

    expect(response.body).toMatchObject({
      success: true,
      analysis: {
        status: "pending",
        description: null,
        labels: [],
        provider: null,
        model: null,
        attemptCount: 0,
        errorMessage: null,
        analysisStartedAt: null,
        analyzedAt: null,
      },
    });
  });

  // ==================================================
  // TEST 5: COMPLETED ANALYSIS
  // ==================================================

  it("returns the saved description and labels for completed analysis", async () => {
    const mediaId = await createMediaRecord();

    await createAnalysisRecord(mediaId, "gemini", "gemini-3.5-flash-lite");

    await updateAnalysisStatus(mediaId, "processing");

    const mockAnalysis = {
      description:
        "People celebrating a wedding outdoors in traditional clothing.",
      labels: [
        { name: "wedding", confidence: 0.95 },
        { name: "outdoor", confidence: 0.9 },
        { name: "celebration", confidence: 0.92 },
      ],
    };

    await updateAnalysisResult(
      mediaId,
      mockAnalysis,
      "gemini",
      "gemini-3.5-flash-lite",
    );

    const response = await request(app)
      .get(`/api/v1/media/${mediaId}/analysis`)
      .set("Cookie", `session=${sessionId}`);

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(true);

    expect(response.body.analysis).toMatchObject({
      status: "completed",
      description: mockAnalysis.description,
      labels: mockAnalysis.labels,
      provider: "gemini",
      model: "gemini-3.5-flash-lite",
      attemptCount: 1,
      errorMessage: null,
    });

    expect(response.body.analysis.analyzedAt).not.toBeNull();
  });

  // ==================================================
  // TEST 6: PROCESSING STATUS
  // ==================================================

  it("returns processing status while image analysis is running", async () => {
    const mediaId = await createMediaRecord();

    await createAnalysisRecord(mediaId, "gemini", "gemini-3.5-flash-lite");

    await updateAnalysisStatus(mediaId, "processing");

    const response = await request(app)
      .get(`/api/v1/media/${mediaId}/analysis`)
      .set("Cookie", `session=${sessionId}`);

    expect(response.status).toBe(200);

    expect(response.body.analysis).toMatchObject({
      status: "processing",
      provider: "gemini",
      model: "gemini-3.5-flash-lite",
      attemptCount: 1,
    });

    expect(response.body.analysis.analysisStartedAt).not.toBeNull();
  });

  // ==================================================
  // TEST 7: FAILED ANALYSIS STATUS
  // ==================================================

  it("returns failure details when image analysis fails", async () => {
    const mediaId = await createMediaRecord();

    await createAnalysisRecord(mediaId, "gemini", "gemini-3.5-flash-lite");

    await updateAnalysisStatus(mediaId, "processing");

    await updateAnalysisStatus(mediaId, "failed", "Gemini request failed");

    const response = await request(app)
      .get(`/api/v1/media/${mediaId}/analysis`)
      .set("Cookie", `session=${sessionId}`);

    expect(response.status).toBe(200);

    expect(response.body.analysis).toMatchObject({
      status: "failed",
      description: null,
      labels: [],
      provider: "gemini",
      model: "gemini-3.5-flash-lite",
      attemptCount: 1,
      errorMessage: "Gemini request failed",
    });
  });

  // ==================================================
  // TEST 8: ANALYSIS INDEPENDENT OF THUMBNAIL STATUS
  // ==================================================

  it("returns completed analysis even when thumbnail processing has failed", async () => {
    const mediaId = await createMediaRecord(userId, "failed");

    await createAnalysisRecord(mediaId, "gemini", "gemini-3.5-flash-lite");

    await updateAnalysisStatus(mediaId, "processing");

    const mockAnalysis = {
      description: "A family celebration outdoors.",
      labels: [
        { name: "family", confidence: 0.95 },
        { name: "celebration", confidence: 0.9 },
      ],
    };

    await updateAnalysisResult(
      mediaId,
      mockAnalysis,
      "gemini",
      "gemini-3.5-flash-lite",
    );

    const response = await request(app)
      .get(`/api/v1/media/${mediaId}/analysis`)
      .set("Cookie", `session=${sessionId}`);

    expect(response.status).toBe(200);

    expect(response.body.analysis).toMatchObject({
      status: "completed",
      description: mockAnalysis.description,
      labels: mockAnalysis.labels,
      provider: "gemini",
      model: "gemini-3.5-flash-lite",
      attemptCount: 1,
      errorMessage: null,
    });
  });

  // ==================================================
  // TEST 9: RESPONSE PRIVACY
  // ==================================================

  it("does not expose internal database identifiers or timestamps", async () => {
    const mediaId = await createMediaRecord();

    await createAnalysisRecord(mediaId, "gemini", "gemini-3.5-flash-lite");

    const response = await request(app)
      .get(`/api/v1/media/${mediaId}/analysis`)
      .set("Cookie", `session=${sessionId}`);

    expect(response.status).toBe(200);

    expect(response.body.analysis).not.toHaveProperty("id");
    expect(response.body.analysis).not.toHaveProperty("media_file_id");
    expect(response.body.analysis).not.toHaveProperty("created_at");
    expect(response.body.analysis).not.toHaveProperty("updated_at");
  });
});
