import express from "express";
import { uploadImage } from "../controllers/media.controller.js";

const mediaRouter = express.Router();

mediaRouter.get("/upload", uploadImage);

export default mediaRouter;
