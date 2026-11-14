
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto; 

-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    display_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MEDIA STATUS ENUM
DO $$
BEGIN
     CREATE TYPE media_status AS ENUM ('uploaded','failed');
EXCEPTION
     WHEN duplicate_object THEN NULL;
END $$;


-- MEDIA FILES TABLE
CREATE TABLE IF NOT EXISTS media_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    status media_status NOT NULL DEFAULT 'uploaded'
);


-- INDEX FOR USER MEDIA QUERIES
CREATE INDEX IF NOT EXISTS idx_media_files_user_id
ON media_files(user_id);

CREATE INDEX IF NOT EXISTS idx_media_files_uploaded_at
ON media_files(uploaded_at DESC);