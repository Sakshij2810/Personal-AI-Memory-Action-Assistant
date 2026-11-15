import type { Response, Request, NextFunction } from "express";
import redis from "../shared/redis/redis.js";

export const isAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const sessionId = req.cookies?.session;
    console.log("sessionId....", sessionId);
    if (!sessionId) {
      return res.status(401).json({ message: "Unauthorised" });
    }

    const session = await redis.get(`session:${sessionId}`);
    console.log("session....", session);

    if (!session) {
      return res.status(401).json({ message: "session expired" });
    }

    req.user = JSON.parse(session);
    console.log(" req.user....", req.user);
    next();
  } catch (error: unknown) {
    console.error("Authentication middleware error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
};
