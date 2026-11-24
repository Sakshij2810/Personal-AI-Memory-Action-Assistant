import pool from "../../config/db.js";
import { env } from "../../lib/env.js";

/**
 * Verifies that integration tests are connected exclusively
 * to the dedicated test database.
 *
 * Never run destructive test operations against memora_ai.
 */
export const assertTestDatabase = async (): Promise<void> => {
  const result = await pool.query("SELECT current_database() AS name");

  const databaseName = result.rows[0]?.name;

  if (databaseName !== "memora_ai_test") {
    throw new Error(
      `Unsafe database: ${databaseName}. Expected memora_ai_test.`,
    );
  }

  if (!env.DATABASE_URL.includes("memora_ai_test")) {
    throw new Error("Unsafe DATABASE_URL. Expected memora_ai_test.");
  }
};

export { pool as testPool };
