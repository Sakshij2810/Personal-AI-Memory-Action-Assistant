import express from "express";
import {
  getCurrentUser,
  GoogleAuth,
  logOut,
} from "../controllers/auth.controller.js";
import { isAuth } from "../middleware/isAuth.js";

const authRouter = express.Router();

authRouter.post("/login", GoogleAuth);
authRouter.post("/logout", logOut);
authRouter.get("/me", isAuth, getCurrentUser);

export default authRouter;
