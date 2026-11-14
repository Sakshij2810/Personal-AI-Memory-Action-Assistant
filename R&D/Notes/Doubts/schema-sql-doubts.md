SQL – Quick Revision Summary

1. UUID: A unique identifier generated using gen_random_uuid().

2. CREATE EXTENSION pgcrypto: Enables PostgreSQL cryptographic functions, including UUID generation.

3. DO $$ ... BEGIN ... END $$: Executes a procedural SQL block. Used here to create an ENUM safely without errors if it already exists.

4. ENUM: A custom data type that restricts values. Example: media_status allows only uploaded and failed.

5. Foreign Key: Connects two tables. Here, media_files.user_id references users.id.

6. ON DELETE CASCADE: Automatically deletes related media database records when their parent user is deleted.

7. CHECK (file_size > 0): Ensures file size is always greater than zero.

8. TIMESTAMPTZ: Stores date and time with timezone awareness.

9. Index: An additional data structure that helps PostgreSQL retrieve records faster.

10. IF NOT EXISTS: Prevents errors when creating an object that already exists.

11. DESC: Sorts values in descending order (newest first for dates).

12. Composite Index: An index on multiple columns, e.g. (user_id, uploaded_at DESC), useful for filtering a user's media and sorting by upload date.

Remember: Indexes improve read performance but require extra storage and can slow down writes.
