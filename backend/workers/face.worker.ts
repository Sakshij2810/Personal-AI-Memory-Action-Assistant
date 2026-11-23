import { Worker } from "bullmq";
import { readFile } from "node:fs/promises";
import path from "node:path";

import bullmqRedis from "../shared/redis/bullmq-connection.js";
import { mediaStorageDir } from "../config/media-storage.js";
import { env } from "../lib/env.js";
import pool from "../config/db.js";

import type { ProcessFaceJobData } from "../queues/face.queue.js";

import {
  markFaceProcessingStarted,
  markFaceProcessingFailed,
  saveDetectedFaces,
  type DetectedFaceInput,
} from "../services/faces/face.repository.js";

import {
  recoverStuckFaceProcessingJobs,
  recoverUnqueuedFaceProcessingJobs,
} from "../helpers/face.helper.js";

interface PythonFace {
  face_number: number;
  bounding_box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  detection_confidence: number;
  embedding: number[];
}

interface PythonFaceResponse {
  success: boolean;
  total_faces: number;
  faces: PythonFace[];
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const validatePythonResponse = (data: unknown): DetectedFaceInput[] => {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid response from face service.");
  }

  const response = data as PythonFaceResponse;

  if (
    response.success !== true ||
    !Number.isInteger(response.total_faces) ||
    !Array.isArray(response.faces) ||
    response.total_faces !== response.faces.length
  ) {
    throw new Error("Face service returned an invalid response.");
  }

  return response.faces.map((face) => {
    const box = face.bounding_box;

    if (
      !Number.isInteger(face.face_number) ||
      face.face_number < 1 ||
      !box ||
      !isFiniteNumber(box.x) ||
      !isFiniteNumber(box.y) ||
      !isFiniteNumber(box.width) ||
      !isFiniteNumber(box.height) ||
      box.x < 0 ||
      box.y < 0 ||
      box.width <= 0 ||
      box.height <= 0 ||
      !isFiniteNumber(face.detection_confidence) ||
      face.detection_confidence < 0 ||
      face.detection_confidence > 1 ||
      !Array.isArray(face.embedding) ||
      face.embedding.length !== 128 ||
      !face.embedding.every(isFiniteNumber)
    ) {
      throw new Error(
        `Face service returned invalid data for face ${face.face_number}.`,
      );
    }

    return {
      faceNumber: face.face_number,
      boundingBox: box,
      detectionConfidence: face.detection_confidence,
      embedding: face.embedding,
    };
  });
};

const isSafeStoragePath = (filePath: string) => {
  const relativePath = path.relative(mediaStorageDir, filePath);

  return (
    relativePath !== "" &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
};

export const faceWorker = new Worker<ProcessFaceJobData>(
  "face-processing",

  async (job) => {
    const { mediaId, userId } = job.data;

    console.log(`Starting face processing: ${mediaId}`);

    // 1. Find the original media and verify ownership.
    const mediaResult = await pool.query(
      `
      SELECT id, storage_key, mime_type
      FROM media_files
      WHERE id = $1 AND user_id = $2
      `,
      [mediaId, userId],
    );

    // 2. Skip media that has already been deleted.
    if (mediaResult.rowCount === 0) {
      console.log(`Media ${mediaId} was deleted. Skipping face processing.`);
      return { success: true, skipped: true, mediaId };
    }

    const { storage_key, mime_type } = mediaResult.rows[0];

    // 3. Validate MIME type.
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedMimeTypes.includes(mime_type)) {
      throw new Error(`Unsupported image MIME type: ${mime_type}`);
    }

    // 4. Resolve and validate original image path.
    const imagePath = path.resolve(mediaStorageDir, storage_key);

    if (!isSafeStoragePath(imagePath)) {
      throw new Error("Invalid image storage path.");
    }

    // 5. Mark this attempt as processing.
    await markFaceProcessingStarted(mediaId);

    // 6. Read original image.
    const imageBuffer = await readFile(imagePath);

    // 7. Send original image to Python Face Service.
    const formData = new FormData();

    formData.append(
      "file",
      new Blob([new Uint8Array(imageBuffer)], {
        type: mime_type,
      }),
      path.basename(storage_key),
    );

    const response = await fetch(
      `${env.FACE_SERVICE_URL.replace(/\/+$/, "")}/face-embeddings`,
      {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(120_000),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");

      throw new Error(
        `Face service returned HTTP ${response.status}: ${errorBody.slice(0, 1000)}`,
      );
    }

    // 8. Parse and validate Python response.
    const responseData: unknown = await response.json();
    const faces = validatePythonResponse(responseData);

    // 9. Persist detected faces transactionally.
    const saved = await saveDetectedFaces(mediaId, userId, faces);

    if (!saved) {
      console.log(
        `Media ${mediaId} was deleted before face results could be saved.`,
      );

      return { success: true, skipped: true, mediaId };
    }

    console.log(
      `Face processing completed: ${mediaId}. Detected ${faces.length} faces.`,
    );

    return {
      success: true,
      mediaId,
      totalFaces: faces.length,
    };
  },

  {
    connection: bullmqRedis,
    concurrency: 1,
  },
);

// ------------------------------------------------------------------
// Recovery
// ------------------------------------------------------------------

let isRecoveryRunning = false;

const runFaceRecovery = async () => {
  if (isRecoveryRunning) return;

  isRecoveryRunning = true;

  try {
    await recoverUnqueuedFaceProcessingJobs();
    await recoverStuckFaceProcessingJobs();
  } catch (error) {
    console.error("Face processing recovery failed:", error);
  } finally {
    isRecoveryRunning = false;
  }
};

// ------------------------------------------------------------------
// Worker lifecycle
// ------------------------------------------------------------------

let recoveryInterval: ReturnType<typeof setInterval> | undefined;

faceWorker.on("ready", () => {
  console.log("Face processing worker is ready and waiting for jobs...");

  void runFaceRecovery();

  if (!recoveryInterval) {
    recoveryInterval = setInterval(() => {
      void runFaceRecovery();
    }, 30_000);
  }
});

faceWorker.on("active", (job) => {
  console.log(`Face job ${job.id} is ACTIVE`);
});

faceWorker.on("completed", (job) => {
  console.log(`Face job ${job.id} COMPLETED`);
});

faceWorker.on("failed", async (job, error) => {
  console.error(`Face job ${job?.id} FAILED:`, error.message);

  if (!job) return;

  const maxAttempts = job.opts.attempts ?? 1;

  if (job.attemptsMade >= maxAttempts) {
    const { mediaId } = job.data;

    try {
      await markFaceProcessingFailed(mediaId, error.message);

      console.log(`Face processing ${mediaId} marked as FAILED`);
    } catch (dbError) {
      console.error("Failed to update face processing status:", dbError);
    }
  } else {
    console.log(
      `Retrying face processing... Attempt ${job.attemptsMade} of ${maxAttempts}`,
    );
  }
});

faceWorker.on("error", (error) => {
  console.error("Face worker error:", error);
});

export const closeFaceWorker = async () => {
  if (recoveryInterval) {
    clearInterval(recoveryInterval);
    recoveryInterval = undefined;
  }

  await faceWorker.close();

  console.log("Face processing worker closed successfully.");
};
