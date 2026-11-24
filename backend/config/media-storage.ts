// backend/config/media-storage.ts

import path from "node:path";
import { env } from "../lib/env.js";

const resolveStoragePath = (
  envName: "MEDIA_STORAGE_DIR" | "MEDIA_THUMBNAIL_DIR",
  defaultDirectory: string,
): string => {
  const configuredPath = env[envName];

  return path.resolve(process.cwd(), configuredPath || defaultDirectory);
};

export const mediaStorageDir = resolveStoragePath(
  "MEDIA_STORAGE_DIR",
  "UploadMediaLocalStorage",
);

export const mediaThumbnailDir = resolveStoragePath(
  "MEDIA_THUMBNAIL_DIR",
  "UploadMediaThumbnails",
);

export const faceCropStorageDir = path.resolve(
  process.cwd(),
  "UploadFaceCrops",
);
