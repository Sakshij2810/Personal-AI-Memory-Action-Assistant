import { getAuth } from "firebase-admin/auth";
import crypto from "crypto";
import type { Request, Response } from "express";

import { app } from "../config/firebase.js";
import pool from "../config/db.js";
import redis from "../shared/redis/redis.js";

export const GoogleAuth = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res
        .status(400)
        .json({ success: false, error: "Firebase ID token is required" });
    }

    // 1. Verify Firebase ID token
    const decoded = await getAuth(app).verifyIdToken(token);

    // 2. Find existing user or create a new user
    const result = await pool.query(
      `
     INSERT INTO users (firebase_uid, email, display_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (firebase_uid)
     DO UPDATE SET 
         email = COALESCE(EXCLUDED.email, users.email),
         display_name = COALESCE(EXCLUDED.display_name, users.display_name)
     RETURNING id, firebase_uid, email, display_name, created_at
        `,
      [decoded.uid, decoded.email ?? null, decoded.name ?? null],
    );

    const user = result.rows[0];

    // 3. Generate unique session ID
    const sessionId = crypto.randomUUID();

    // 4. Store session in Redis for 7 days
    await redis.set(
      `session:${sessionId}`,
      JSON.stringify({
        userId: user.id,
        email: user.email,
        name: user.display_name,
      }),
      "EX",
      7 * 24 * 60 * 60,
    );

    // 5. Store session ID in HTTP-only cookie
    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("session", sessionId, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Google authentication error:", error);

    return res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

export const logOut = async (req: Request, res: Response) => {
  try {
    const sessionId = req.cookies?.session;

    // 1.Delete session from Redis if it exists
    if (sessionId) {
      await redis.del(`session:${sessionId}`);
    }

    // 2. Clear session cookie
    const isProduction = process.env.NODE_ENV === "production";

    res.clearCookie("session", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    });

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);

    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};
