// backend/controllers/face.controller.ts

import path from "node:path";
import { faceCropStorageDir } from "../config/media-storage.js";
import {
  findFaceCropForUser,
  findFaceGroups,
  findSimilarFaces,
} from "../services/faces/face.repository.js";
import { type Request, type Response } from "express";
import { readFile } from "node:fs/promises";
import {
  assignFaceToPersonForUser,
  confirmPersonIdentity,
  getPeopleForUser,
  getPersonGalleryForUser,
  mergePeopleForUser,
  removeFaceFromPersonForUser,
  splitPersonForUser,
} from "../services/faces/people.repository.js";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const DEFAULT_MIN_SIMILARITY = 0.45;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// --------------------------------- getSimilarFaces ---------------------------------
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

// --------------------------------- getFaceGroups ---------------------------------
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
// --------------------------------- getFaceImage ---------------------------------
// Returns a user's face crop only after verifying ownership through the database.
export const getFaceImage = async (req: Request, res: Response) => {
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

    const cropKey = await findFaceCropForUser(faceId, userId);

    if (!cropKey) {
      return res.status(404).json({
        success: false,
        message: "Face image not found.",
      });
    }

    const imagePath = path.resolve(faceCropStorageDir, cropKey);

    const relativePath = path.relative(faceCropStorageDir, imagePath);

    if (
      relativePath === "" ||
      relativePath === ".." ||
      relativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativePath)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid face image path.",
      });
    }

    const imageBuffer = await readFile(imagePath);

    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Cache-Control", "private, max-age=3600");

    return res.status(200).send(imageBuffer);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return res.status(404).json({
        success: false,
        message: "Face image not found.",
      });
    }

    console.error("Get face image error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve face image.",
    });
  }
};

// --------------------------------- confirmPerson ---------------------------------

export const confirmPerson = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";

    const faceIds: unknown = req.body?.faceIds;

    if (!name || name.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Name must contain between 1 and 100 characters.",
      });
    }

    if (
      !Array.isArray(faceIds) ||
      faceIds.length < 2 ||
      faceIds.length > 200 ||
      !faceIds.every(
        (id): id is string =>
          typeof id === "string" &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            id,
          ),
      ) ||
      new Set(faceIds).size !== faceIds.length
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide 2–200 unique valid face IDs.",
      });
    }

    const person = await confirmPersonIdentity({
      userId,
      name,
      faceIds,
    });

    return res.status(201).json({
      success: true,
      message: "Person identity confirmed successfully.",
      person,
    });
  } catch (error: unknown) {
    const errorCode = (error as { code?: string })?.code;

    if (errorCode === "FACES_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "One or more selected faces were not found.",
      });
    }

    if (errorCode === "FACES_ALREADY_ASSIGNED" || errorCode === "23505") {
      return res.status(409).json({
        success: false,
        message: "One or more faces are already assigned to a person.",
      });
    }

    console.error("Confirm person error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to confirm person identity.",
    });
  }
};
// --------------------------------- getPeople ---------------------------------

export const getPeople = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const result = await getPeopleForUser(userId);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Get people error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve people.",
    });
  }
};

// --------------------------------- getPersonGallery ---------------------------------

export const getPersonGallery = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const personId = Array.isArray(req.params.personId)
      ? req.params.personId[0]
      : req.params.personId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    if (
      !personId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        personId,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid person ID is required.",
      });
    }

    const result = await getPersonGalleryForUser(personId, userId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Person not found.",
      });
    }

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Get person gallery error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve person gallery.",
    });
  }
};

// --------------------------------- assignPersonFace ---------------------------------

export const assignPersonFace = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const personId = Array.isArray(req.params.personId)
      ? req.params.personId[0]
      : req.params.personId;
    const faceId = Array.isArray(req.params.faceId)
      ? req.params.faceId[0]
      : req.params.faceId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    if (
      !personId ||
      !UUID_REGEX.test(personId) ||
      !faceId ||
      !UUID_REGEX.test(faceId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid person ID and face ID are required.",
      });
    }

    const result = await assignFaceToPersonForUser(personId, faceId, userId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Person or face not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        result === "already_assigned"
          ? "Face is already assigned to this person."
          : "Face assigned successfully.",
    });
  } catch (error: unknown) {
    const errorCode = (error as { code?: string })?.code;

    if (errorCode === "23505") {
      return res.status(409).json({
        success: false,
        message: "Face is already assigned.",
      });
    }

    console.error("Assign person face error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to assign face.",
    });
  }
};

// --------------------------------- removePersonFace ---------------------------------

export const removePersonFace = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const personId = Array.isArray(req.params.personId)
      ? req.params.personId[0]
      : req.params.personId;
    const faceId = Array.isArray(req.params.faceId)
      ? req.params.faceId[0]
      : req.params.faceId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    if (
      !personId ||
      !UUID_REGEX.test(personId) ||
      !faceId ||
      !UUID_REGEX.test(faceId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid person ID and face ID are required.",
      });
    }

    const removed = await removeFaceFromPersonForUser(personId, faceId, userId);

    if (!removed) {
      return res.status(404).json({
        success: false,
        message: "Person-face assignment not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Face removed from person successfully.",
    });
  } catch (error) {
    console.error("Remove person face error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove face from person.",
    });
  }
};

// --------------------------------- mergePeople ---------------------------------

export const mergePeople = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    const targetPersonId = Array.isArray(req.params.personId)
      ? req.params.personId[0]
      : req.params.personId;

    const sourcePersonId = req.body?.sourcePersonId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    if (
      !targetPersonId ||
      !UUID_REGEX.test(targetPersonId) ||
      typeof sourcePersonId !== "string" ||
      !UUID_REGEX.test(sourcePersonId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid target and source person IDs are required.",
      });
    }

    if (targetPersonId === sourcePersonId) {
      return res.status(400).json({
        success: false,
        message: "Cannot merge a person into itself.",
      });
    }

    const result = await mergePeopleForUser(
      targetPersonId,
      sourcePersonId,
      userId,
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "One or both people were not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "People merged successfully.",
      ...result,
    });
  } catch (error) {
    console.error("Merge people error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to merge people.",
    });
  }
};

// --------------------------------- splitPerson ---------------------------------

export const splitPerson = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    const sourcePersonId = Array.isArray(req.params.personId)
      ? req.params.personId[0]
      : req.params.personId;

    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";

    const faceIds: unknown = req.body?.faceIds;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    if (!sourcePersonId || !UUID_REGEX.test(sourcePersonId)) {
      return res.status(400).json({
        success: false,
        message: "Valid source person ID is required.",
      });
    }

    if (!name || name.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Name must contain between 1 and 100 characters.",
      });
    }

    if (
      !Array.isArray(faceIds) ||
      faceIds.length < 1 ||
      faceIds.length > 200 ||
      !faceIds.every(
        (id): id is string => typeof id === "string" && UUID_REGEX.test(id),
      ) ||
      new Set(faceIds).size !== faceIds.length
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide 1–200 unique valid face IDs.",
      });
    }

    const person = await splitPersonForUser({
      userId,
      sourcePersonId,
      newPersonName: name,
      faceIds,
    });

    if (!person) {
      return res.status(404).json({
        success: false,
        message: "Source person not found.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Person split successfully.",
      person,
    });
  } catch (error: unknown) {
    const errorCode = (error as { code?: string })?.code;

    if (errorCode === "SPLIT_FACES_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "One or more selected faces do not belong to this person.",
      });
    }

    console.error("Split person error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to split person.",
    });
  }
};
