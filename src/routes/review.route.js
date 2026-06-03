import express from "express";
import { isAuthenticated } from "../middlewares/auth.middlewares.js";
import { upload } from "../middlewares/multer.middlewares.js";
import { createReview, getPlaceReviews, getMyReviews, deleteReview } from "../controllers/review.controller.js";

const router = express.Router();

router.use(isAuthenticated);

router.post("/", upload.array("images", 5), createReview);
router.get("/my", getMyReviews);
router.get("/place/:placeId", getPlaceReviews);
router.delete("/:id", deleteReview);

export default router;
