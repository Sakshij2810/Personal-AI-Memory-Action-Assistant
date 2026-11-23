import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import multer from "multer";
import type { ErrorRequestHandler } from "express";

import authRouter from "./routes/auth.routes.js";
import mediaRouter from "./routes/media.routes.js";
import { isAuth } from "./middleware/isAuth.js";
import { env } from "./lib/env.js";
import faceRouter from "./routes/face.routes.js";

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);

app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.send("Hello from server");
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/media", isAuth, mediaRouter);
app.use("/api/v1/faces", isAuth, faceRouter);

// Centralized error handling
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error("Request error:", err);

  // Multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        success: false,
        message: "File size must not exceed 20 MB.",
      });
      return;
    }

    if (err.code === "LIMIT_FILE_COUNT") {
      res.status(400).json({
        success: false,
        message: "You can upload a maximum of 20 images per request.",
      });
      return;
    }

    res.status(400).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // Unsupported MIME type
  if (
    err instanceof Error &&
    err.message === "Only JPG, JPEG, PNG and WEBP images are allowed."
  ) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // Other unexpected errors
  res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
};

app.use(errorHandler);

export default app;

// app.ts: creates and exports the Express application.
