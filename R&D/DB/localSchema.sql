
-- R&D/DB/localSchema.sql
-- Queries for inspecting and debugging the local database.
-- These queries do not modify database structure or records.


-- =========================================================
-- 1. CHECK USERS
-- =========================================================

SELECT *
FROM users;


-- =========================================================
-- 2. CHECK MEDIA FILES
-- =========================================================

SELECT *
FROM media_files;


-- =========================================================
-- 3. CHECK ALL TABLES
-- =========================================================

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;


-- =========================================================
-- 4. CHECK RECENT MEDIA PROCESSING STATUS
-- =========================================================

SELECT
    id,
    user_id,
    filename,
    storage_key,
    thumbnail_key,
    processing_status,
    processing_started_at,
    uploaded_at,
    updated_at
FROM media_files
ORDER BY uploaded_at DESC
LIMIT 10;


-- =========================================================
-- 5. CHECK MEDIA FILES TABLE COLUMNS
-- =========================================================

SELECT
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'media_files'
ORDER BY ordinal_position;


-- =========================================================
-- 6. CHECK PROCESSING STATUS ENUM VALUES
-- =========================================================

SELECT
    enumlabel
FROM pg_enum
JOIN pg_type
    ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'processing_status'
ORDER BY enumsortorder;


-- =========================================================
-- 7. COUNT MEDIA FILES BY PROCESSING STATUS
-- =========================================================

SELECT
    processing_status,
    COUNT(*) AS total
FROM media_files
GROUP BY processing_status
ORDER BY processing_status;


-- =========================================================
-- 8. CHECK MEDIA FILES THAT NEED PROCESSING
-- =========================================================

SELECT
    id,
    user_id,
    storage_key,
    processing_status,
    processing_started_at
FROM media_files
WHERE processing_status IN ('uploaded', 'processing')
ORDER BY uploaded_at ASC;


-- =========================================================
-- 9. CHECK MEDIA FILES WITH MISSING THUMBNAILS
-- =========================================================

SELECT
    id,
    filename,
    processing_status,
    thumbnail_key
FROM media_files
WHERE processing_status = 'completed'
  AND thumbnail_key IS NULL;


-- =========================================================
-- 10. CHECK DATABASE NAME
-- =========================================================

SELECT current_database();





SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'media_analysis'
ORDER BY ordinal_position;


SELECT typname
FROM pg_type
WHERE typname = 'analysis_status';


SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'media_analysis';


SELECT
    extname,
    extversion
FROM pg_extension
WHERE extname = 'vector';



SELECT * FROM detected_faces;
SELECT * FROM media_analysis;
SELECT * FROM media_files;
SELECT * FROM users;



-- Users should remain
SELECT COUNT(*) FROM users;

-- Check remaining records in other tables
SELECT
    schemaname,
    relname AS table_name,
    n_live_tup AS estimated_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY relname;

SELECT
    mf.id AS media_id,
    mf.filename,
    mf.face_processing_status,
    COUNT(df.id) AS detected_faces
FROM media_files mf
LEFT JOIN detected_faces df
    ON df.media_file_id = mf.id
WHERE mf.id IN (
    '77f3b707-1c70-4a21-a9cd-301cac19c5d9',
    'f7dfa897-952c-4779-890d-7dcbee4c4f70',
    'e7d87ebe-b77e-4168-a51c-fde3345f4868'
)
GROUP BY mf.id, mf.filename, mf.face_processing_status;


SELECT
    df.id AS face_id,
    mf.filename,
    df.face_number,
    vector_dims(df.embedding) AS embedding_dimensions
FROM detected_faces df
JOIN media_files mf
    ON mf.id = df.media_file_id
WHERE mf.id IN (
    '77f3b707-1c70-4a21-a9cd-301cac19c5d9',
    'f7dfa897-952c-4779-890d-7dcbee4c4f70',
    'e7d87ebe-b77e-4168-a51c-fde3345f4868'
)
ORDER BY mf.filename, df.face_number;


UPDATE media_files
SET
  face_processing_status = 'pending',
  face_processing_started_at = NULL,
  face_processing_error = NULL
WHERE face_processing_status = 'completed';

SELECT id, status, face_processing_status
FROM media_files
WHERE face_processing_status = 'completed';

SELECT
    COUNT(*) AS total_media,
    COUNT(*) FILTER (
        WHERE face_processing_status = 'pending'
    ) AS pending,
    COUNT(*) FILTER (
        WHERE face_processing_status = 'completed'
    ) AS completed,
    COUNT(*) FILTER (
        WHERE face_processing_status = 'failed'
    ) AS failed
FROM media_files;