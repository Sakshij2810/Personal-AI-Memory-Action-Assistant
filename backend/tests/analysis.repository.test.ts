// backend/tests/analysis.repository.test.ts

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import crypto from "node:crypto";

import pool from "../config/db.js";
import { env } from "../lib/env.js";

import {
  createAnalysisRecord,
  updateAnalysisStatus,
  updateAnalysisResult,
  getAnalysisByMediaId,
} from "../services/ai/analysis.repository.js";

describe("Analysis repository integration tests", () => {
  let userId: string;
  let mediaId: string;

  // ==================================================
  // DATABASE SAFETY
  // ==================================================

  beforeAll(async () => {
    const dbResult = await pool.query("SELECT current_database() AS name");

    if (dbResult.rows[0].name !== "memora_ai_test") {
      throw new Error(
        `Unsafe database: ${dbResult.rows[0].name}. Expected memora_ai_test.`,
      );
    }

    // Confirm that the configured test database is correct.
    if (!env.DATABASE_URL.includes("memora_ai_test")) {
      throw new Error("Unsafe DATABASE_URL. Expected memora_ai_test.");
    }
  });

  // ==================================================
  // TEST DATA SETUP
  // ==================================================

  beforeEach(async () => {
    const firebaseUid = `analysis-test-${crypto.randomUUID()}`;

    // Create a test user.
    const userResult = await pool.query(
      `
      INSERT INTO users (
        firebase_uid,
        email,
        display_name
      )
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [firebaseUid, `${firebaseUid}@example.com`, "Analysis Repository Test"],
    );

    userId = userResult.rows[0].id;

    // Create a test media record.
    const mediaResult = await pool.query(
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
        "analysis-test.jpg",
        `${crypto.randomUUID()}.jpg`,
        "image/jpeg",
        1024,
      ],
    );

    mediaId = mediaResult.rows[0].id;
  });

  // ==================================================
  // CLEANUP
  // ==================================================

  afterEach(async () => {
    // Deleting the user also deletes media_files
    // and media_analysis through ON DELETE CASCADE.
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  });

  afterAll(async () => {
    await pool.end();
  });

  // ==================================================
  // TEST 1: CREATE ANALYSIS RECORD
  // ==================================================

  it("creates an analysis record with pending status", async () => {
    const record = await createAnalysisRecord(
      mediaId,
      "gemini",
      "gemini-3.5-flash-lite",
    );

    expect(record).toBeDefined();
    expect(record.media_file_id).toBe(mediaId);
    expect(record.provider).toBe("gemini");
    expect(record.model).toBe("gemini-3.5-flash-lite");
    expect(record.status).toBe("pending");
    expect(record.attempt_count).toBe(0);
    expect(record.description).toBeNull();
    expect(record.labels).toEqual([]);
    expect(record.error_message).toBeNull();
  });

  // ==================================================
  // TEST 2: IDEMPOTENCY
  // ==================================================

  it("reuses an existing analysis record without creating duplicates", async () => {
    const firstRecord = await createAnalysisRecord(
      mediaId,
      "gemini",
      "gemini-3.5-flash-lite",
    );

    // Change the existing record's status.
    await updateAnalysisStatus(mediaId, "processing");

    // Attempt to create the same record again.
    const secondRecord = await createAnalysisRecord(
      mediaId,
      "gemini",
      "gemini-3.5-flash-lite",
    );

    expect(secondRecord.id).toBe(firstRecord.id);
    expect(secondRecord.status).toBe("processing");
    expect(secondRecord.attempt_count).toBe(1);

    const countResult = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM media_analysis
      WHERE media_file_id = $1
      `,
      [mediaId],
    );

    expect(countResult.rows[0].count).toBe(1);
  });

  // ==================================================
  // TEST 3: UPDATE ANALYSIS STATUS
  // ==================================================

  it("updates analysis status and increments attempt count", async () => {
    await createAnalysisRecord(mediaId, "gemini", "gemini-3.5-flash-lite");

    const processingRecord = await updateAnalysisStatus(mediaId, "processing");

    expect(processingRecord).not.toBeNull();
    expect(processingRecord?.status).toBe("processing");
    expect(processingRecord?.attempt_count).toBe(1);
    expect(processingRecord?.analysis_started_at).toBeInstanceOf(Date);

    const failedRecord = await updateAnalysisStatus(
      mediaId,
      "failed",
      "Gemini request failed",
    );

    expect(failedRecord?.status).toBe("failed");
    expect(failedRecord?.attempt_count).toBe(1);
    expect(failedRecord?.error_message).toBe("Gemini request failed");
  });

  // ==================================================
  // TEST 4: SAVE ANALYSIS RESULT
  // ==================================================

  it("saves the AI description and labels successfully", async () => {
    await createAnalysisRecord(mediaId, "gemini", "gemini-3.5-flash-lite");

    const analysis = {
      description: "People in traditional clothing celebrating outdoors.",
      labels: [
        {
          name: "wedding",
          confidence: 0.95,
        },
        {
          name: "outdoor",
          confidence: 0.9,
        },
      ],
    };

    const record = await updateAnalysisResult(
      mediaId,
      analysis,
      "gemini",
      "gemini-3.5-flash-lite",
    );

    expect(record).not.toBeNull();
    expect(record?.description).toBe(analysis.description);
    expect(record?.labels).toEqual(analysis.labels);
    expect(record?.provider).toBe("gemini");
    expect(record?.model).toBe("gemini-3.5-flash-lite");
    expect(record?.status).toBe("completed");
    expect(record?.error_message).toBeNull();
    expect(record?.analyzed_at).toBeInstanceOf(Date);
  });

  // ==================================================
  // TEST 5: GET ANALYSIS BY MEDIA ID
  // ==================================================

  it("retrieves an analysis record using its media ID", async () => {
    await createAnalysisRecord(mediaId, "gemini", "gemini-3.5-flash-lite");

    const analysis = await getAnalysisByMediaId(mediaId);

    expect(analysis).not.toBeNull();
    expect(analysis?.media_file_id).toBe(mediaId);
    expect(analysis?.status).toBe("pending");
  });

  // ==================================================
  // TEST 6: NON-EXISTENT RECORD
  // ==================================================

  it("returns null when an analysis record does not exist", async () => {
    const analysis = await getAnalysisByMediaId(crypto.randomUUID());

    expect(analysis).toBeNull();
  });

  // ==================================================
  // TEST 7: UPDATE NON-EXISTENT RECORD
  // ==================================================

  it("returns null when updating a non-existent analysis record", async () => {
    const result = await updateAnalysisStatus(
      crypto.randomUUID(),
      "processing",
    );

    expect(result).toBeNull();
  });
});
