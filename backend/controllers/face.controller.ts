// backend/controllers/face.controller.ts

import {
  findFaceGroups,
  findSimilarFaces,
} from "../services/faces/face.repository.js";
import { type Request, type Response } from "express";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const DEFAULT_MIN_SIMILARITY = 0.45;

export const getSimilarFaces = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const faceId = Array.isArray(req.params.faceId)
      ? req.params.faceId[0]
      : req.params.faceId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    if (!faceId) {
      return res.status(400).json({
        success: false,
        message: "Face ID is required.",
      });
    }

    const rawLimit = req.query.limit;
    const rawMinSimilarity = req.query.minSimilarity;

    const limit = rawLimit === undefined ? DEFAULT_LIMIT : Number(rawLimit);

    const minSimilarity =
      rawMinSimilarity === undefined
        ? DEFAULT_MIN_SIMILARITY
        : Number(rawMinSimilarity);

    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      return res.status(400).json({
        success: false,
        message: `Limit must be an integer between 1 and ${MAX_LIMIT}.`,
      });
    }

    if (
      !Number.isFinite(minSimilarity) ||
      minSimilarity < 0 ||
      minSimilarity > 1
    ) {
      return res.status(400).json({
        success: false,
        message: "minSimilarity must be between 0 and 1.",
      });
    }

    const result = await findSimilarFaces(faceId, userId, limit, minSimilarity);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Face not found.",
      });
    }

    return res.status(200).json({
      success: true,
      anchorFaceId: result.anchorFaceId,
      threshold: minSimilarity,
      count: result.matches.length,
      matches: result.matches,
    });
  } catch (error: unknown) {
    console.error("Get similar faces error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to find similar faces.",
    });
  }
};

export const getFaceGroups = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const rawMinSimilarity = req.query.minSimilarity;

    const minSimilarity =
      rawMinSimilarity === undefined
        ? DEFAULT_MIN_SIMILARITY
        : Number(rawMinSimilarity);

    if (
      !Number.isFinite(minSimilarity) ||
      minSimilarity < 0 ||
      minSimilarity > 1
    ) {
      return res.status(400).json({
        success: false,
        message: "minSimilarity must be between 0 and 1.",
      });
    }

    const result = await findFaceGroups(userId, minSimilarity);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    console.error("Get face groups error:", error);

    if (
      error instanceof Error &&
      error.message.includes("supports up to 2000")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to generate face groups.",
    });
  }
};
