import "dotenv/config";
import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is missing in your .env file");
}

const bullmqRedis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

bullmqRedis.on("connect", () => {
  console.log("BullMQ Redis connected");
});

bullmqRedis.on("ready", () => {
  console.log("BullMQ Redis is ready to accept commands");
});

bullmqRedis.on("error", (error) => {
  console.error("BullMQ Redis error:", error.message);
});

export default bullmqRedis;
