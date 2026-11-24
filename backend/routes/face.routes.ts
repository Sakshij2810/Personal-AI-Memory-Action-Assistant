import express from "express";

import {
  confirmPerson,
  getFaceGroups,
  getFaceImage,
  getSimilarFaces,
  getPeople,
  getPersonGallery,
  assignPersonFace,
  removePersonFace,
  mergePeople,
  splitPerson,
} from "../controllers/face.controller.js";

const faceRouter = express.Router();

faceRouter.get("/groups", getFaceGroups);

faceRouter.get("/people", getPeople);
faceRouter.get("/people/:personId/gallery", getPersonGallery);
faceRouter.post("/people/confirm", confirmPerson);

faceRouter.patch("/people/:personId/faces/:faceId", assignPersonFace);
faceRouter.delete("/people/:personId/faces/:faceId", removePersonFace);

faceRouter.post("/people/:personId/merge", mergePeople);
faceRouter.post("/people/:personId/split", splitPerson);

faceRouter.get("/:faceId/image", getFaceImage);
faceRouter.get("/:faceId/similar", getSimilarFaces);

export default faceRouter;
