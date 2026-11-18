import fs from "node:fs";
import crypto from "crypto";
import multer from "multer";

import { mediaStorageDir } from "../config/media-storage.js";

/*
1. Create the uploads folder if it doesn't exist.
   Git doesn't track empty folders, so we create it when needed.

2. Configure Multer:
   - storage   → where and how to save the uploaded file
   - fileFilter → which files are allowed

3. diskStorage has two methods:
   - destination → decides where the file is stored
   - filename    → decides what name the file gets

4. Both destination and filename receive:
   req, file, cb
   - req  → request
   - file → uploaded file information
   - cb   → callback used to tell Multer what to do

5. fileFilter checks the uploaded file.
   Here, we only allow JPG, PNG and WebP files based on their MIME type.
*/

// 1.  Create the uploads folder if it doesn't exist.
export const uploadPath = mediaStorageDir;

fs.mkdirSync(uploadPath, { recursive: true });

const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
const mimeExtensions: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

// 2. Configure Multer: storage, fileFilter

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadPath);
  },

  filename: (_req, file, cb) => {
    const extension = mimeExtensions[file.mimetype];
    cb(null, `${crypto.randomUUID()}${extension}`);
  },
});

/*
Why use UUID filenames?
Instead of saving a file as wedding-photo.jpg, we save it with a random name, such as: 

UploadMediaLocalStorage/
├── 2d1c...a81.jpg
├── 7f3b...c92.png
└── 9a4e...b11.webp

This avoids filename collisions and prevents users from choosing storage filenames.
 */

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, JPEG, PNG and WEBP images are allowed."));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB per image
    files: 20, // Maximum 20 images per request
  },
});
