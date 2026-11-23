
BEGIN;

-- Enable pgvector in this database
CREATE EXTENSION IF NOT EXISTS vector;

-- Create face processing status enum
DO $$
BEGIN
    CREATE TYPE face_processing_status AS ENUM (
        'pending',
        'processing',
        'completed',
        'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Add independent face-processing lifecycle to media_files
ALTER TABLE media_files
    ADD COLUMN IF NOT EXISTS face_processing_status
        face_processing_status NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS face_processing_started_at
        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS face_processing_attempt_count
        INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS face_processing_error
        TEXT;

-- Add retry counter constraint
DO $$
BEGIN
    ALTER TABLE media_files
        ADD CONSTRAINT media_files_face_attempt_count_check
        CHECK (face_processing_attempt_count >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Store detected faces and their embeddings
CREATE TABLE IF NOT EXISTS detected_faces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    media_file_id UUID NOT NULL
        REFERENCES media_files(id) ON DELETE CASCADE,

    face_number INTEGER NOT NULL
        CHECK (face_number > 0),

    bounding_box JSONB NOT NULL
        CHECK (jsonb_typeof(bounding_box) = 'object'),

    detection_confidence REAL NOT NULL
        CHECK (
            detection_confidence >= 0
            AND detection_confidence <= 1
        ),

    embedding vector(128) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (media_file_id, face_number)
);

-- Indexes for recovery and face retrieval
CREATE INDEX IF NOT EXISTS idx_media_files_face_processing_status
ON media_files(face_processing_status);

CREATE INDEX IF NOT EXISTS idx_media_files_face_processing_started_at
ON media_files(face_processing_started_at);

CREATE INDEX IF NOT EXISTS idx_detected_faces_media_file_id
ON detected_faces(media_file_id);

COMMIT;
