import "dotenv/config";
import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is missing in your .env file");
}

const redis = new Redis(redisUrl);

redis.on("connect", () => {
  console.log("redis connected");
});

redis.on("ready", () => {
  console.log("Redis is ready to accept commands");
});

redis.on("error", (error) => {
  console.log("Redis connection error:", error.message);
});

export default redis;
