import express from "express";
import "dotenv/config";
import pool from "./config/db.js";
const app = express();
const PORT = process.env.PORT || 8000;
app.get("/", (req, res) => {
    res.send("Hello from server");
});
async function startServer() {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is missing. Add it to your .env file.");
    }
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is missing. Add it to your .env file.");
    }
    // Fail early if PostgreSQL is not reachable.
    await pool.query("SELECT 1");
    console.log("✅ PostgreSQL connected successfully!");
    console.log(`📦 Database: ${new URL(process.env.DATABASE_URL).pathname.slice(1)}`);
    app.listen(PORT, () => {
        console.log(`Server is running on PORT ${PORT}`);
    });
}
startServer().catch((error) => {
    console.error("Could not start the server:", error.message);
    process.exit(1);
});
export default app;
//# sourceMappingURL=index.js.map