import { testPool } from "./test-db.js";

/**
 * Deletes a test user and all associated records.
 *
 * Related records are expected to be removed through
 * the database's ON DELETE CASCADE constraints.
 */
export const cleanupTestUser = async (
  userId: string | undefined,
): Promise<void> => {
  if (!userId) return;

  await testPool.query(
    `
    DELETE FROM users
    WHERE id = $1
    `,
    [userId],
  );
};

/**
 * Deletes multiple test users.
 */
export const cleanupTestUsers = async (userIds: string[]): Promise<void> => {
  const uniqueIds = [...new Set(userIds)].filter(Boolean);

  if (uniqueIds.length === 0) return;

  await testPool.query(
    `
    DELETE FROM users
    WHERE id = ANY($1::uuid[])
    `,
    [uniqueIds],
  );
};
