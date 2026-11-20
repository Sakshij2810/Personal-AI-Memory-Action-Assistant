import "dotenv/config";
import app from "./app.js";
import pool from "./config/db.js";
import { env } from "./lib/env.js";

const PORT = env.PORT || 8000;

async function startServer() {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Add it to your .env file.");
  }

  if (!env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing. Add it to your .env file.");
  }

  await pool.query("SELECT 1");

  console.log("PostgreSQL connected successfully!");

  app.listen(PORT, () => {
    console.log(`Server is running on PORT ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Could not start the server:", error.message);
  process.exit(1);
});

// index.ts : starts the actual server.
