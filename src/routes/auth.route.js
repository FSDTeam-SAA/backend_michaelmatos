import express from "express";
import { isAuthenticated } from "../middlewares/auth.middlewares.js";
import {
  register, verifyEmail, resendVerification, login,
  refreshToken, logout, forgotPassword, resetPassword, changePassword,
} from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register", register);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);
router.post("/login", login);
router.post("/refresh-token", refreshToken);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

router.use(isAuthenticated);
router.post("/logout", logout);
router.patch("/change-password", changePassword);

export default router;
