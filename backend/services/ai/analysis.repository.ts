// backend/services/ai/analysis.repository.ts
/*
This file will contain the SQL operations. Keeping database queries separate from ai.service.ts 
means our AI service won't become responsible for database persistence.
*/

import pool from "../../config/db.js";

import type { ImageAnalysisResult } from "./types.js";

// Analysis lifecycle statuses.
export type AnalysisStatus = "pending" | "processing" | "completed" | "failed";

// Database record structure.
export interface AnalysisRecord {
  id: string;
  media_file_id: string;
  description: string | null;
  labels: ImageAnalysisResult["labels"];
  provider: string | null;
  model: string | null;
  status: AnalysisStatus;
  attempt_count: number;
  error_message: string | null;
  analysis_started_at: Date | null;
  analyzed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// 1. Create an analysis record.
// If a record already exists, reuse it without resetting its status.
export async function createAnalysisRecord(
  mediaFileId: string,
  provider: string,
  model: string,
): Promise<AnalysisRecord> {
  const result = await pool.query<AnalysisRecord>(
    `
      INSERT INTO media_analysis (
        media_file_id,
        provider,
        model
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (media_file_id)
      DO UPDATE SET media_file_id = EXCLUDED.media_file_id
      RETURNING *;
    `,
    [mediaFileId, provider, model],
  );

  return result.rows[0];
}

// 2. Update analysis status.
export async function updateAnalysisStatus(
  mediaFileId: string,
  status: AnalysisStatus,
  errorMessage: string | null = null,
): Promise<AnalysisRecord | null> {
  const result = await pool.query<AnalysisRecord>(
    `
    UPDATE media_analysis
    SET
      status = $2::analysis_status,
      error_message = $3,
      attempt_count = CASE
        WHEN $2::analysis_status = 'processing'::analysis_status
          THEN attempt_count + 1
        ELSE attempt_count
      END,
      analysis_started_at = CASE
        WHEN $2::analysis_status = 'processing'::analysis_status
          THEN NOW()
        ELSE analysis_started_at
      END,
      updated_at = NOW()
    WHERE media_file_id = $1
    RETURNING *;
  `,
    [mediaFileId, status, errorMessage],
  );

  return result.rows[0] ?? null;
}

// 3. Save the completed AI analysis result.
export async function updateAnalysisResult(
  mediaFileId: string,
  analysis: ImageAnalysisResult,
  provider: string,
  model: string,
): Promise<AnalysisRecord | null> {
  const result = await pool.query<AnalysisRecord>(
    `
      UPDATE media_analysis
      SET
        description = $2,
        labels = $3::jsonb,
        provider = $4,
        model = $5,
        status = 'completed',
        error_message = NULL,
        analyzed_at = NOW(),
        updated_at = NOW()
      WHERE media_file_id = $1
      RETURNING *;
    `,
    [
      mediaFileId,
      analysis.description,
      JSON.stringify(analysis.labels),
      provider,
      model,
    ],
  );

  return result.rows[0] ?? null;
}

// 4. Retrieve analysis for a media file.
export async function getAnalysisByMediaId(
  mediaFileId: string,
): Promise<AnalysisRecord | null> {
  const result = await pool.query<AnalysisRecord>(
    `
      SELECT *
      FROM media_analysis
      WHERE media_file_id = $1;
    `,
    [mediaFileId],
  );

  return result.rows[0] ?? null;
}
