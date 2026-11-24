import crypto from "node:crypto";

import { testPool } from "./test-db.js";

export interface TestUser {
  id: string;
  firebaseUid: string;
  email: string;
}

export interface TestMedia {
  id: string;
  userId: string;
  storageKey: string;
}

export interface TestFace {
  id: string;
  mediaFileId: string;
  faceNumber: number;
}

const createUniqueId = () => crypto.randomUUID();

/**
 * Creates an isolated test user.
 */
export const createTestUser = async (): Promise<TestUser> => {
  const firebaseUid = `test-${createUniqueId()}`;
  const email = `${firebaseUid}@example.com`;

  const result = await testPool.query(
    `
    INSERT INTO users (
      firebase_uid,
      email,
      display_name
    )
    VALUES ($1, $2, $3)
    RETURNING id
    `,
    [firebaseUid, email, "Memora Test User"],
  );

  return {
    id: result.rows[0].id,
    firebaseUid,
    email,
  };
};

/**
 * Creates a test media file belonging to a user.
 */
export const createTestMedia = async (userId: string): Promise<TestMedia> => {
  const storageKey = `${createUniqueId()}.jpg`;

  const result = await testPool.query(
    `
    INSERT INTO media_files (
      user_id,
      filename,
      storage_key,
      mime_type,
      file_size
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
    `,
    [userId, "test-image.jpg", storageKey, "image/jpeg", 1024],
  );

  return {
    id: result.rows[0].id,
    userId,
    storageKey,
  };
};

/**
 * Creates a detected face with a 128-dimensional embedding.
 */
export const createTestFace = async (
  mediaFileId: string,
  faceNumber = 1,
): Promise<TestFace> => {
  const embedding = Array.from(
    { length: 128 },
    (_, index) => (index + 1) / 128,
  );

  const boundingBox = {
    x: 10,
    y: 20,
    width: 100,
    height: 100,
  };

  const cropKey = `${createUniqueId()}.webp`;

  const result = await testPool.query(
    `
    INSERT INTO detected_faces (
      media_file_id,
      face_number,
      bounding_box,
      detection_confidence,
      embedding,
      crop_key
    )
    VALUES (
      $1,
      $2,
      $3::jsonb,
      $4,
      $5::vector,
      $6
    )
    RETURNING id
    `,
    [
      mediaFileId,
      faceNumber,
      JSON.stringify(boundingBox),
      0.95,
      `[${embedding.join(",")}]`,
      cropKey,
    ],
  );

  return {
    id: result.rows[0].id,
    mediaFileId,
    faceNumber,
  };
};
