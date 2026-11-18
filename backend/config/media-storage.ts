import path from "node:path";

const resolveStoragePath = (
  envName: string,
  defaultDirectory: string,
): string => {
  const configuredPath = process.env[envName];

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
