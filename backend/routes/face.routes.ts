// backend/routes/face.routes.ts

import express from "express";
import {
  getFaceGroups,
  getSimilarFaces,
} from "../controllers/face.controller.js";

const faceRouter = express.Router();

faceRouter.get("/groups", getFaceGroups);
faceRouter.get("/:faceId/similar", getSimilarFaces);

export default faceRouter;
