import type { Request, Response } from "express";

export const uploadImage = async (req: Request, res: Response) => {
  try {
    console.log("req.user//////", req.user);
    res.status(200).json({ user: req.user, success: true });
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ success: false, error: error });
  }
};
