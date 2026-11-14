import { Pool } from "pg";
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
});
pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL pool error:", error.message);
});
export default pool;
//# sourceMappingURL=db.js.map