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
import { isAuth } from "../middleware/isAuth.js";

const mediaRouter = express.Router();

mediaRouter.post(
  "/upload/single",
  isAuth,
  upload.single("image"),
  uploadSingleImage,
);
mediaRouter.post(
  "/upload/multiple",
  isAuth,
  upload.array("images", 20),
  uploadMultipleImages,
);

mediaRouter.get("/", isAuth, getUserImages);
mediaRouter.get("/:id/file", isAuth, getImageFile);
mediaRouter.get("/:id/thumbnail", isAuth, getThumbnailImageFile);
mediaRouter.delete("/:id", isAuth, deleteImage);

export default mediaRouter;
