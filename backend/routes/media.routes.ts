import express from "express";
import {
  getImageFile,
  getUserImages,
  uploadMultipleImages,
  uploadSingleImage,
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

export default mediaRouter;
