// backend/config/db.ts
import { Pool } from "pg";
import { env } from "../lib/env.js";

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.PGSSL === true ? { rejectUnauthorized: false } : false,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error.message);
});

export default pool;
