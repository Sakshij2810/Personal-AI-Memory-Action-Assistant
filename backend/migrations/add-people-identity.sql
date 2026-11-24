
BEGIN;

-- One confirmed person belongs to one application user. ---- people stores confirmed identities, such as Sakshi, Mother, Father.
CREATE TABLE IF NOT EXISTS people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL
        CHECK (length(trim(name)) BETWEEN 1 AND 100),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (id, user_id)
);

-- Connect confirmed people to their detected face records. ----- person_faces connects each detected face to a confirmed person.
CREATE TABLE IF NOT EXISTS person_faces (
    person_id UUID NOT NULL
        REFERENCES people(id) ON DELETE CASCADE,

    face_id UUID NOT NULL
        REFERENCES detected_faces(id) ON DELETE CASCADE,

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (person_id, face_id),

    -- A detected face can belong to only one confirmed person.
    UNIQUE (face_id)
);

CREATE INDEX IF NOT EXISTS idx_people_user_id
ON people(user_id);

CREATE INDEX IF NOT EXISTS idx_person_faces_person_id
ON person_faces(person_id);

CREATE INDEX IF NOT EXISTS idx_person_faces_assigned_at
ON person_faces(assigned_at);

COMMIT;
