-- Check users
SELECT * FROM users;

-- Check media files
SELECT * FROM media_files;


-- Check all tables
SELECT
    table_name
FROM information_schema.tables
WHERE table_schema = 'public';


