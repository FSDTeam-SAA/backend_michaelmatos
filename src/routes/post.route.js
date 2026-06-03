import express from "express";
import { isAuthenticated } from "../middlewares/auth.middlewares.js";
import { upload } from "../middlewares/multer.middlewares.js";
import {
  createPost, getFeed, getPostById, updatePost,
  makePostPrivate, deletePost, likePost, getPostLikes, bookmarkPost,
} from "../controllers/post.controller.js";

const router = express.Router();

router.use(isAuthenticated);

router.get("/feed", getFeed);
router.post("/", upload.array("images", 10), createPost);
router.get("/:id", getPostById);
router.patch("/:id", updatePost);
router.patch("/:id/toggle-private", makePostPrivate);
router.delete("/:id", deletePost);
router.post("/:id/like", likePost);
router.get("/:id/likes", getPostLikes);
router.post("/:id/bookmark", bookmarkPost);

export default router;
