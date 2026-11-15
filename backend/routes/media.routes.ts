import express from "express";
import {
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

export default mediaRouter;
