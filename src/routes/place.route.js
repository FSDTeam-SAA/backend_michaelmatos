import express from "express";
import { isAuthenticated } from "../middlewares/auth.middlewares.js";
import { getPlaces, getTrendingPlaces, getPlaceById } from "../controllers/place.controller.js";

const router = express.Router();

router.use(isAuthenticated);

router.get("/", getPlaces);
router.get("/trending", getTrendingPlaces);
router.get("/:id", getPlaceById);

export default router;
