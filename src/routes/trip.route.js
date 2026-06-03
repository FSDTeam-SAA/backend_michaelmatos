import express from "express";
import { isAuthenticated } from "../middlewares/auth.middlewares.js";
import { upload } from "../middlewares/multer.middlewares.js";
import { createTrip, getMyTrips, getTripById, updateTrip, deleteTrip } from "../controllers/trip.controller.js";

const router = express.Router();

router.use(isAuthenticated);

router.post("/", upload.single("coverImage"), createTrip);
router.get("/my", getMyTrips);
router.get("/:id", getTripById);
router.patch("/:id", upload.single("coverImage"), updateTrip);
router.delete("/:id", deleteTrip);

export default router;
