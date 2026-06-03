import express from "express";
import { isAuthenticated } from "../middlewares/auth.middlewares.js";
import { search, searchSuggestions } from "../controllers/search.controller.js";

const router = express.Router();

router.use(isAuthenticated);

router.get("/", search);
router.get("/suggestions", searchSuggestions);

export default router;
