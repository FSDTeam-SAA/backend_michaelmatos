import express from "express";
import { isAuthenticated } from "../middlewares/auth.middlewares.js";
import { getPlaces, getTrendingPlaces, getPlaceById, bookmarkPlace } from "../controllers/place.controller.js";

const router = express.Router();

router.use(isAuthenticated);

router.get("/", getPlaces);
router.get("/trending", getTrendingPlaces);
router.post("/:id/bookmark", bookmarkPlace);
router.get("/:id", getPlaceById);

export default router;
