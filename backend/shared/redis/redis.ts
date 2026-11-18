import "dotenv/config";
import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is missing in your .env file");
}

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 1, // A command gets a limited number of retries before failing.
  retryStrategy(times) {
    return Math.min(times * 500, 3000); // Redis reconnect attempts use increasing delays, capped at 3 seconds.
  },
  connectTimeout: 5000, // A connection attempt has a 5-second timeout.
});

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
