import catchAsync from "../utility/catchAsync.js";
import { sendResponse } from "../utility/helper.js";
import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { Trip } from "../models/trip.model.js";
import { Place } from "../models/place.model.js";
import { Review } from "../models/review.model.js";
import { Follow } from "../models/follow.model.js";
import { HelpTicket } from "../models/helpTicket.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Terms } from "../models/terms.model.js";

// ── Dashboard Statistics ─────────────────────────────────────────────────────
export const getDashboardStats = catchAsync(async (req, res, next) => {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const startOfLastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);

  const [
    totalUsers,
    totalPosts,
    totalTrips,
    totalPlaces,
    totalReviews,
    newUsersToday,
    newPostsToday,
    paidUsers,
    usersThisMonth,
    usersLastMonth,
    earningsAgg,
  ] = await Promise.all([
    User.countDocuments({ accountType: "user" }),
    Post.countDocuments(),
    Trip.countDocuments(),
    Place.countDocuments(),
    Review.countDocuments(),
    User.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
    Post.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
    User.countDocuments({ accountType: "user", subscriptionStatus: "paid" }),
    User.countDocuments({ accountType: "user", createdAt: { $gte: startOfMonth } }),
    User.countDocuments({ accountType: "user", createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } }),
    User.aggregate([
      { $match: { accountType: "user" } },
      { $group: { _id: null, total: { $sum: "$totalSpent" } } },
    ]),
  ]);

  const totalEarnings = earningsAgg[0]?.total || 0;
  const freeUsers = Math.max(totalUsers - paidUsers, 0);
  const pct = (cur, prev) => (prev > 0 ? Number((((cur - prev) / prev) * 100).toFixed(1)) : cur > 0 ? 100 : 0);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Dashboard stats",
    data: {
      totalUsers,
      totalPosts,
      totalTrips,
      totalPlaces,
      totalReviews,
      newUsersToday,
      newPostsToday,
      paidUsers,
      freeUsers,
      totalEarnings,
      usersThisMonth,
      usersLastMonth,
      usersGrowthPct: pct(usersThisMonth, usersLastMonth),
    },
  });
});

// ── User Join Comparison (this month vs last month, by day-of-month) ─────────
export const getUserJoinComparison = catchAsync(async (req, res, next) => {
  const now = new Date();
  const startThis = new Date(now.getFullYear(), now.getMonth(), 1);
  const startLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const aggregate = (start, end) =>
    User.aggregate([
      { $match: { accountType: "user", createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: { $dayOfMonth: "$createdAt" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

  const [thisMonth, lastMonth] = await Promise.all([
    aggregate(startThis, new Date(now.getFullYear(), now.getMonth() + 1, 1)),
    aggregate(startLast, startThis),
  ]);

  const map = (arr) => arr.reduce((acc, x) => ({ ...acc, [x._id]: x.count }), {});
  const tMap = map(thisMonth);
  const lMap = map(lastMonth);

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const data = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    return { day, thisMonth: tMap[day] || 0, lastMonth: lMap[day] || 0 };
  });

  sendResponse(res, { statusCode: 200, success: true, message: "User join comparison", data });
});

// ── User Join Chart (last N days/months) ────────────────────────────────────
export const getUserJoinChart = catchAsync(async (req, res, next) => {
  const { period = "30d" } = req.query; // "7d" | "30d" | "12m"

  let groupFormat, startDate;
  const now = new Date();

  if (period === "7d") {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    groupFormat = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
  } else if (period === "30d") {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    groupFormat = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
  } else {
    // 12m
    startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    groupFormat = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
  }

  const data = await User.aggregate([
    { $match: { createdAt: { $gte: startDate }, accountType: "user" } },
    { $group: { _id: groupFormat, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { date: "$_id", count: 1, _id: 0 } },
  ]);

  sendResponse(res, { statusCode: 200, success: true, message: "User join chart data", data });
});

// ── User Management ──────────────────────────────────────────────────────────
export const getUsers = catchAsync(async (req, res, next) => {
  const { search = "", page = 1, limit = 20, isBanned, status } = req.query;
  const skip = (page - 1) * limit;

  const filter = { accountType: "user" };
  if (search) filter.$or = [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }];
  if (isBanned !== undefined) filter.isBanned = isBanned === "true";
  if (status && status !== "all") filter.subscriptionStatus = status; // "paid" | "free"

  const users = await User.find(filter)
    .select("-password -refreshToken -verificationCode -passwordResetCode")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await User.countDocuments(filter);
  sendResponse(res, { statusCode: 200, success: true, message: "Users retrieved", data: { users, total, page: Number(page) } });
});

export const getUserById = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).select("-password -refreshToken -verificationCode -passwordResetCode");
  if (!user) return sendResponse(res, { statusCode: 404, success: false, message: "User not found", data: null });
  sendResponse(res, { statusCode: 200, success: true, message: "User retrieved", data: user });
});

export const banUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return sendResponse(res, { statusCode: 404, success: false, message: "User not found", data: null });

  user.isBanned = !user.isBanned;
  await user.save();

  sendResponse(res, { statusCode: 200, success: true, message: `User ${user.isBanned ? "banned" : "unbanned"} successfully`, data: { isBanned: user.isBanned } });
});

export const deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return sendResponse(res, { statusCode: 404, success: false, message: "User not found", data: null });

  await user.deleteOne();
  sendResponse(res, { statusCode: 200, success: true, message: "User deleted", data: null });
});

// ── Post Management ──────────────────────────────────────────────────────────
export const getPosts = catchAsync(async (req, res, next) => {
  const { search = "", page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const filter = {};
  if (search) filter.caption = { $regex: search, $options: "i" };

  const posts = await Post.find(filter)
    .populate("userId", "name email avatar")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Post.countDocuments(filter);
  sendResponse(res, { statusCode: 200, success: true, message: "Posts retrieved", data: { posts, total, page: Number(page) } });
});

export const deletePostAdmin = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);
  if (!post) return sendResponse(res, { statusCode: 404, success: false, message: "Post not found", data: null });

  await post.deleteOne();
  await User.findByIdAndUpdate(post.userId, { $inc: { postsCount: -1 } });

  sendResponse(res, { statusCode: 200, success: true, message: "Post deleted", data: null });
});

// ── Trip Management ──────────────────────────────────────────────────────────
export const getTrips = catchAsync(async (req, res, next) => {
  const { search = "", status, page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const filter = {};
  if (search) filter.tripName = { $regex: search, $options: "i" };
  if (status && status !== "all") filter.status = status;

  const trips = await Trip.find(filter)
    .populate("userId", "name email avatar")
    .populate("placeId", "name")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Trip.countDocuments(filter);
  sendResponse(res, { statusCode: 200, success: true, message: "Trips retrieved", data: { trips, total, page: Number(page) } });
});

export const deleteTripAdmin = catchAsync(async (req, res, next) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) return sendResponse(res, { statusCode: 404, success: false, message: "Trip not found", data: null });

  if (trip.placeId) await Place.findByIdAndUpdate(trip.placeId, { $inc: { tripCount: -1 } });
  await trip.deleteOne();
  await User.findByIdAndUpdate(trip.userId, { $inc: { tripsCount: -1 } });

  sendResponse(res, { statusCode: 200, success: true, message: "Trip deleted", data: null });
});

// ── Review Management ────────────────────────────────────────────────────────
export const getReviews = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const reviews = await Review.find()
    .populate("userId", "name email avatar")
    .populate("placeId", "name")
    .populate("tripId", "tripName")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Review.countDocuments();
  sendResponse(res, { statusCode: 200, success: true, message: "Reviews retrieved", data: { reviews, total, page: Number(page) } });
});

export const deleteReviewAdmin = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);
  if (!review) return sendResponse(res, { statusCode: 404, success: false, message: "Review not found", data: null });

  await review.deleteOne();
  sendResponse(res, { statusCode: 200, success: true, message: "Review deleted", data: null });
});

// ── Place Management ─────────────────────────────────────────────────────────
export const getPlacesAdmin = catchAsync(async (req, res, next) => {
  const { search = "", page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const filter = {};
  if (search) filter.$or = [{ name: { $regex: search, $options: "i" } }, { country: { $regex: search, $options: "i" } }];

  const places = await Place.find(filter).sort({ tripCount: -1 }).skip(skip).limit(Number(limit));
  const total = await Place.countDocuments(filter);

  sendResponse(res, { statusCode: 200, success: true, message: "Places retrieved", data: { places, total, page: Number(page) } });
});

export const deletePlaceAdmin = catchAsync(async (req, res, next) => {
  const place = await Place.findByIdAndDelete(req.params.id);
  if (!place) return sendResponse(res, { statusCode: 404, success: false, message: "Place not found", data: null });
  sendResponse(res, { statusCode: 200, success: true, message: "Place deleted", data: null });
});

// ── Help Tickets ─────────────────────────────────────────────────────────────
export const getHelpTickets = catchAsync(async (req, res, next) => {
  const { status, page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const filter = {};
  if (status && status !== "all") filter.status = status;

  const tickets = await HelpTicket.find(filter)
    .populate("userId", "name email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await HelpTicket.countDocuments(filter);
  sendResponse(res, { statusCode: 200, success: true, message: "Help tickets retrieved", data: { tickets, total, page: Number(page) } });
});

export const updateTicketStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  const ticket = await HelpTicket.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!ticket) return sendResponse(res, { statusCode: 404, success: false, message: "Ticket not found", data: null });
  sendResponse(res, { statusCode: 200, success: true, message: "Ticket status updated", data: ticket });
});

// ── Subscription Plans ───────────────────────────────────────────────────────
export const getSubscriptions = catchAsync(async (req, res, next) => {
  const plans = await Subscription.find().sort({ price: 1 });
  sendResponse(res, { statusCode: 200, success: true, message: "Subscription plans retrieved", data: plans });
});

export const createSubscription = catchAsync(async (req, res, next) => {
  const { name, description, price, currency, interval, searchLimit, features } = req.body;
  if (!name || price === undefined)
    return sendResponse(res, { statusCode: 400, success: false, message: "Name and price are required", data: null });

  const plan = await Subscription.create({ name, description, price, currency, interval, searchLimit, features });
  sendResponse(res, { statusCode: 201, success: true, message: "Subscription plan created", data: plan });
});

export const updateSubscription = catchAsync(async (req, res, next) => {
  const plan = await Subscription.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!plan) return sendResponse(res, { statusCode: 404, success: false, message: "Plan not found", data: null });
  sendResponse(res, { statusCode: 200, success: true, message: "Subscription plan updated", data: plan });
});

export const deleteSubscription = catchAsync(async (req, res, next) => {
  const plan = await Subscription.findByIdAndDelete(req.params.id);
  if (!plan) return sendResponse(res, { statusCode: 404, success: false, message: "Plan not found", data: null });
  sendResponse(res, { statusCode: 200, success: true, message: "Subscription plan deleted", data: null });
});

// ── Terms & Conditions (and other legal docs) ────────────────────────────────
export const getTerms = catchAsync(async (req, res, next) => {
  const type = req.query.type || "terms";
  let doc = await Terms.findOne({ type });
  if (!doc) doc = await Terms.create({ type, content: "" });
  sendResponse(res, { statusCode: 200, success: true, message: "Terms retrieved", data: doc });
});

export const updateTerms = catchAsync(async (req, res, next) => {
  const type = req.body.type || "terms";
  const { content } = req.body;
  const doc = await Terms.findOneAndUpdate(
    { type },
    { content, updatedBy: req.user._id },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  sendResponse(res, { statusCode: 200, success: true, message: "Terms updated", data: doc });
});
