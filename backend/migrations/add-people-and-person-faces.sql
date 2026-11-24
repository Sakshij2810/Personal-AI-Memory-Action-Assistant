
BEGIN;

-- Confirmed people/identities owned by users
CREATE TABLE IF NOT EXISTS people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Map detected faces to confirmed people
CREATE TABLE IF NOT EXISTS person_faces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    face_id UUID NOT NULL UNIQUE REFERENCES detected_faces(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Efficiently retrieve a user's people
CREATE INDEX IF NOT EXISTS idx_people_user_id
ON people(user_id);

-- Efficiently retrieve faces belonging to a person
CREATE INDEX IF NOT EXISTS idx_person_faces_person_id
ON person_faces(person_id);

COMMIT;
