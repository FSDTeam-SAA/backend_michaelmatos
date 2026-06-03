import express from "express";
import { isAuthenticated } from "../middlewares/auth.middlewares.js";
import { getComments, getReplies, addComment, deleteComment, likeComment } from "../controllers/comment.controller.js";

const router = express.Router();

router.use(isAuthenticated);

router.get("/post/:postId", getComments);
router.get("/:commentId/replies", getReplies);
router.post("/", addComment);
router.delete("/:id", deleteComment);
router.post("/:id/like", likeComment);

export default router;
