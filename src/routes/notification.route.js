import express from "express";
import { isAuthenticated } from "../middlewares/auth.middlewares.js";
import { getNotifications, markAllRead, markOneRead, deleteNotification } from "../controllers/notification.controller.js";

const router = express.Router();

router.use(isAuthenticated);

router.get("/", getNotifications);
router.patch("/mark-all-read", markAllRead);
router.patch("/:id/read", markOneRead);
router.delete("/:id", deleteNotification);

export default router;
