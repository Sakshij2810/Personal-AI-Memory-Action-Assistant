
BEGIN;

-- 1. Remove any existing people records without assigned faces.
DELETE FROM people p
WHERE NOT EXISTS (
    SELECT 1
    FROM person_faces pf
    WHERE pf.person_id = p.id
);

-- 2. Enforce case-insensitive, whitespace-trimmed
-- unique person names per user.
CREATE UNIQUE INDEX IF NOT EXISTS
    idx_people_user_unique_normalized_name
ON people (user_id, LOWER(BTRIM(name)));

-- 3. Automatically remove a person when their last
-- face is deleted or transferred to another person.
CREATE OR REPLACE FUNCTION cleanup_empty_person()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM people p
        WHERE p.id = OLD.person_id
          AND NOT EXISTS (
              SELECT 1
              FROM person_faces pf
              WHERE pf.person_id = OLD.person_id
          );

        RETURN OLD;
    END IF;

    IF OLD.person_id IS DISTINCT FROM NEW.person_id THEN
        DELETE FROM people p
        WHERE p.id = OLD.person_id
          AND NOT EXISTS (
              SELECT 1
              FROM person_faces pf
              WHERE pf.person_id = OLD.person_id
          );
    END IF;

    RETURN NEW;
END;
$$;

-- 4. Attach cleanup trigger.
DROP TRIGGER IF EXISTS
    trigger_cleanup_empty_person
ON person_faces;

CREATE TRIGGER trigger_cleanup_empty_person
AFTER DELETE OR UPDATE OF person_id
ON person_faces
FOR EACH ROW
EXECUTE FUNCTION cleanup_empty_person();

COMMIT;
