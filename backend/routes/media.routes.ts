import express from "express";
import {
  deleteImage,
  getImageFile,
  getUserImages,
  uploadMultipleImages,
  uploadSingleImage,
  getThumbnailImageFile,
} from "../controllers/media.controller.js";
import { upload } from "../middleware/multer.js";

const mediaRouter = express.Router();

mediaRouter.post("/upload/single", upload.single("image"), uploadSingleImage);
mediaRouter.post(
  "/upload/multiple",
  upload.array("images", 20),
  uploadMultipleImages,
);

mediaRouter.get("/", getUserImages);
mediaRouter.get("/:id/file", getImageFile);
mediaRouter.get("/:id/thumbnail", getThumbnailImageFile);
mediaRouter.delete("/:id", deleteImage);

export default mediaRouter;
