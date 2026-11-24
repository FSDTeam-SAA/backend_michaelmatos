import express from "express";
import { isAuthenticated, restrictTo } from "../middlewares/auth.middlewares.js";
import {
  getDashboardStats, getUserJoinChart, getUserJoinComparison,
  getUsers, getUserById, banUser, deleteUser,
  getPosts, deletePostAdmin,
  getTrips, deleteTripAdmin,
  getReviews, deleteReviewAdmin,
  getPlacesAdmin, deletePlaceAdmin,
  getHelpTickets, updateTicketStatus,
  getSubscriptions, createSubscription, updateSubscription, deleteSubscription,
  getTerms, updateTerms,
} from "../controllers/admin.controller.js";

const router = express.Router();

router.use(isAuthenticated, restrictTo("admin"));

// Dashboard
router.get("/dashboard/stats", getDashboardStats);
router.get("/dashboard/user-join-chart", getUserJoinChart);
router.get("/dashboard/user-join-comparison", getUserJoinComparison);

// Users
router.get("/users", getUsers);
router.get("/users/:id", getUserById);
router.patch("/users/:id/ban", banUser);
router.delete("/users/:id", deleteUser);

// Posts
router.get("/posts", getPosts);
router.delete("/posts/:id", deletePostAdmin);

// Trips
router.get("/trips", getTrips);
router.delete("/trips/:id", deleteTripAdmin);

// Reviews
router.get("/reviews", getReviews);
router.delete("/reviews/:id", deleteReviewAdmin);

// Places
router.get("/places", getPlacesAdmin);
router.delete("/places/:id", deletePlaceAdmin);

// Help Tickets
router.get("/help-tickets", getHelpTickets);
router.patch("/help-tickets/:id", updateTicketStatus);

// Subscription Plans
router.get("/subscriptions", getSubscriptions);
router.post("/subscriptions", createSubscription);
router.patch("/subscriptions/:id", updateSubscription);
router.delete("/subscriptions/:id", deleteSubscription);

// Terms & Conditions
router.get("/terms", getTerms);
router.put("/terms", updateTerms);

export default router;
