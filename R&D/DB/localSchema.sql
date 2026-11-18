
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
