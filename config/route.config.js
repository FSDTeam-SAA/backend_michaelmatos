import express from "express";
import authRoutes from "../src/routes/auth.route.js";
import userRoutes from "../src/routes/user.route.js";
import postRoutes from "../src/routes/post.route.js";
import commentRoutes from "../src/routes/comment.route.js";
import tripRoutes from "../src/routes/trip.route.js";
import placeRoutes from "../src/routes/place.route.js";
import notificationRoutes from "../src/routes/notification.route.js";
import reviewRoutes from "../src/routes/review.route.js";
import searchRoutes from "../src/routes/search.route.js";
import adminRoutes from "../src/routes/admin.route.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/posts", postRoutes);
router.use("/comments", commentRoutes);
router.use("/trips", tripRoutes);
router.use("/places", placeRoutes);
router.use("/notifications", notificationRoutes);
router.use("/reviews", reviewRoutes);
router.use("/search", searchRoutes);
router.use("/admin", adminRoutes);

export default router;
