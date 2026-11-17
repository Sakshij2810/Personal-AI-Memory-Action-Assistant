-- Check users
SELECT * FROM users;

-- Check media files
SELECT * FROM media_files;


-- Check all tables
SELECT
    table_name
FROM information_schema.tables
WHERE table_schema = 'public';


-- Phase 2 
-- 1. Create the processing status enum
DO $$
BEGIN
    CREATE TYPE processing_status AS ENUM (
        'uploaded',
        'processing',
        'completed',
        'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add processing_status column to media_files
ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS processing_status
processing_status NOT NULL DEFAULT 'uploaded';

-- 3. We already added processing_status. Now we need columns to store the results of Sharp processing.
ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS thumbnail_key TEXT,
ADD COLUMN IF NOT EXISTS width INTEGER,
ADD COLUMN IF NOT EXISTS height INTEGER,
ADD COLUMN IF NOT EXISTS format VARCHAR(20);

-- tests
SELECT id, user_id, storage_key, processing_status
FROM media_files
ORDER BY uploaded_at DESC
LIMIT 5;