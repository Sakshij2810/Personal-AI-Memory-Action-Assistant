// backend/services/faces/face-crop.service.ts
// Generates padded square WebP face crops from the original image and stores them by media ID.
import sharp from "sharp";
import path from "node:path";
import { mkdir, rm } from "node:fs/promises";

import { faceCropStorageDir } from "../../config/media-storage.js";
import type { DetectedFaceInput } from "./types.js";

type FaceCropInput = Omit<DetectedFaceInput, "cropKey">;

export interface GeneratedFaceCrop {
  faceNumber: number;
  cropKey: string;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getCropRegion = (
  boundingBox: DetectedFaceInput["boundingBox"],
  imageWidth: number,
  imageHeight: number,
) => {
  const centerX = boundingBox.x + boundingBox.width / 2;
  const centerY = boundingBox.y + boundingBox.height / 2;

  // Include some surrounding context around the detected face.
  const desiredSize = Math.ceil(
    Math.max(boundingBox.width, boundingBox.height) * 1.6,
  );

  const size = Math.max(1, Math.min(desiredSize, imageWidth, imageHeight));

  const left = Math.round(clamp(centerX - size / 2, 0, imageWidth - size));

  const top = Math.round(clamp(centerY - size / 2, 0, imageHeight - size));

  return {
    left,
    top,
    width: size,
    height: size,
  };
};

export const generateFaceCrops = async (
  imageBuffer: Buffer,
  mediaId: string,
  faces: FaceCropInput[],
): Promise<GeneratedFaceCrop[]> => {
  if (faces.length === 0) {
    return [];
  }

  const metadata = await sharp(imageBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Unable to determine original image dimensions.");
  }

  const mediaCropDirectory = path.resolve(faceCropStorageDir, mediaId);

  await mkdir(mediaCropDirectory, { recursive: true });

  const generatedCrops: GeneratedFaceCrop[] = [];

  for (const face of faces) {
    const region = getCropRegion(
      face.boundingBox,
      metadata.width,
      metadata.height,
    );

    const filename = `face-${face.faceNumber}.webp`;

    const cropKey = path.posix.join(mediaId, filename);

    const outputPath = path.resolve(faceCropStorageDir, mediaId, filename);

    const relativePath = path.relative(faceCropStorageDir, outputPath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new Error("Invalid face crop storage path.");
    }

    await sharp(imageBuffer)
      .extract(region)
      .resize(256, 256, {
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: 82 })
      .toFile(outputPath);

    generatedCrops.push({
      faceNumber: face.faceNumber,
      cropKey,
    });
  }

  return generatedCrops;
};

export const deleteFaceCropsForMedia = async (mediaId: string) => {
  const mediaCropDirectory = path.resolve(faceCropStorageDir, mediaId);

  const relativePath = path.relative(faceCropStorageDir, mediaCropDirectory);

  if (
    relativePath === "" ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error("Invalid face crop directory.");
  }

  await rm(mediaCropDirectory, {
    recursive: true,
    force: true,
  });
};
