import type { Response, Request, NextFunction } from "express";
import redis from "../shared/redis/redis.js";

export const isAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // 1. Extract the session cookie from the request.
    const sessionId = req.cookies?.session;

    // 2. Check whether the session ID exists. if not return 401
    if (!sessionId) {
      return res.status(401).json({ message: "Unauthorised" });
    }

    // 3. retrieve the session data from Redis
    const session = await redis.get(`session:${sessionId}`);

    // 4. Check whether the session exists in Redis.
    if (!session) {
      return res.status(401).json({ message: "session expired" });
    }

    // 5. Attach the parsed user information to req.user
    req.user = JSON.parse(session);

    next();
  } catch (error: unknown) {
    console.error("Authentication middleware error:", error);

    return res.status(503).json({
      success: false,
      message:
        "Authentication service is temporarily unavailable. Please try again.",
    });
  }
};
