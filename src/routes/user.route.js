import express from "express";
import { isAuthenticated } from "../middlewares/auth.middlewares.js";
import { upload } from "../middlewares/multer.middlewares.js";
import {
  getMyProfile, updateProfile, getUserProfile,
  followUser, unfollowUser, getFollowers, getFollowing,
  blockUser, unblockUser, getUserPosts, getUserTrips,
  getSavedPosts, submitHelpTicket,
} from "../controllers/user.controller.js";

const router = express.Router();

router.use(isAuthenticated);

router.get("/me", getMyProfile);
router.patch("/me", upload.fields([{ name: "avatar", maxCount: 1 }, { name: "coverPhoto", maxCount: 1 }]), updateProfile);
router.get("/me/saved-posts", getSavedPosts);
router.post("/help-ticket", submitHelpTicket);

router.get("/:id", getUserProfile);
router.post("/:id/follow", followUser);
router.delete("/:id/follow", unfollowUser);
router.post("/:id/block", blockUser);
router.delete("/:id/block", unblockUser);
router.get("/:id/followers", getFollowers);
router.get("/:id/following", getFollowing);
router.get("/:id/posts", getUserPosts);
router.get("/:id/trips", getUserTrips);

export default router;
