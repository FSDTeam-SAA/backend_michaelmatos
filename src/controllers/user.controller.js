import catchAsync from "../utility/catchAsync.js";
import AppError from "../errors/appError.js";
import { sendResponse, uploadOnCloudinary, createNotification } from "../utility/helper.js";
import { User } from "../models/user.model.js";
import { Follow } from "../models/follow.model.js";
import { Post } from "../models/post.model.js";
import { Bookmark } from "../models/bookmark.model.js";
import { Trip } from "../models/trip.model.js";
import { HelpTicket } from "../models/helpTicket.model.js";

export const getMyProfile = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id).select("-password -refreshToken -verificationCode -passwordResetCode");
  sendResponse(res, { statusCode: 200, success: true, message: "Profile retrieved", data: user });
});

export const updateProfile = catchAsync(async (req, res, next) => {
  const { name, bio, location } = req.body;
  const updateData = {};
  if (name) updateData.name = name;
  if (bio !== undefined) updateData.bio = bio;
  if (location !== undefined) updateData.location = location;

  if (req.files && req.files.avatar) {
    const result = await uploadOnCloudinary(req.files.avatar[0].buffer, { folder: "travel/avatars" });
    updateData.avatar = result.secure_url;
  }
  if (req.files && req.files.coverPhoto) {
    console.log("Uploading cover photo...");
    const result = await uploadOnCloudinary(req.files.coverPhoto[0].buffer, { folder: "travel/coverPhotos" });
    updateData.coverPhoto = result.secure_url;
  }

  const updated = await User.findByIdAndUpdate(req.user._id, updateData, { new: true })
    .select("-password -refreshToken -verificationCode -passwordResetCode");

  sendResponse(res, { statusCode: 200, success: true, message: "Profile updated", data: updated });
});

export const getUserProfile = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const user = await User.findById(id).select("name email avatar bio location followersCount followingCount postsCount tripsCount");
  if (!user) return next(new AppError(404, "User not found"));

  // Check if requester follows this user
  let isFollowing = false;
  if (req.user) {
    const follow = await Follow.findOne({ followerId: req.user._id, followingId: id });
    isFollowing = !!follow;
  }

  sendResponse(res, { statusCode: 200, success: true, message: "User profile retrieved", data: { ...user.toObject(), isFollowing } });
});

export const followUser = catchAsync(async (req, res, next) => {
  const { id } = req.params; // user to follow
  if (req.user._id.equals(id)) return next(new AppError(400, "Cannot follow yourself"));

  const target = await User.findById(id);
  if (!target) return next(new AppError(404, "User not found"));

  const existing = await Follow.findOne({ followerId: req.user._id, followingId: id });
  if (existing) return next(new AppError(400, "Already following this user"));

  await Follow.create({ followerId: req.user._id, followingId: id });
  await User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: 1 } });
  await User.findByIdAndUpdate(id, { $inc: { followersCount: 1 } });

  await createNotification(id, `${req.user.name} started following you`, "new-follow", { relatedId: req.user._id, relatedType: "user" });

  sendResponse(res, { statusCode: 200, success: true, message: "Followed successfully", data: null });
});

export const unfollowUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const follow = await Follow.findOne({ followerId: req.user._id, followingId: id });
  if (!follow) return next(new AppError(400, "You are not following this user"));

  await follow.deleteOne();
  await User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: -1 } });
  await User.findByIdAndUpdate(id, { $inc: { followersCount: -1 } });

  sendResponse(res, { statusCode: 200, success: true, message: "Unfollowed successfully", data: null });
});

export const getFollowers = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { search = "", page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const follows = await Follow.find({ followingId: id })
    .populate({ path: "followerId", select: "name avatar location", match: search ? { name: { $regex: search, $options: "i" } } : {} })
    .skip(skip)
    .limit(Number(limit))
    .sort({ createdAt: -1 });

  const followers = follows.filter((f) => f.followerId).map((f) => f.followerId);
  sendResponse(res, { statusCode: 200, success: true, message: "Followers retrieved", data: followers });
});

export const getFollowing = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { search = "", page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const follows = await Follow.find({ followerId: id })
    .populate({ path: "followingId", select: "name avatar location", match: search ? { name: { $regex: search, $options: "i" } } : {} })
    .skip(skip)
    .limit(Number(limit))
    .sort({ createdAt: -1 });

  const following = follows.filter((f) => f.followingId).map((f) => f.followingId);
  sendResponse(res, { statusCode: 200, success: true, message: "Following retrieved", data: following });
});

export const blockUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  if (req.user._id.equals(id)) return next(new AppError(400, "Cannot block yourself"));

  await User.findByIdAndUpdate(req.user._id, { $addToSet: { blockedUsers: id } });
  // Remove follow relationship if exists
  const follow = await Follow.findOne({ followerId: req.user._id, followingId: id });
  if (follow) {
    await follow.deleteOne();
    await User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: -1 } });
    await User.findByIdAndUpdate(id, { $inc: { followersCount: -1 } });
  }

  sendResponse(res, { statusCode: 200, success: true, message: "User blocked", data: null });
});

export const unblockUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  await User.findByIdAndUpdate(req.user._id, { $pull: { blockedUsers: id } });
  sendResponse(res, { statusCode: 200, success: true, message: "User unblocked", data: null });
});

export const getUserPosts = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { page = 1, limit = 12 } = req.query;
  const skip = (page - 1) * limit;

  const isOwnProfile = req.user._id.equals(id);
  const filter = { userId: id, ...(isOwnProfile ? {} : { isPrivate: false }) };

  const posts = await Post.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
  const total = await Post.countDocuments(filter);

  sendResponse(res, { statusCode: 200, success: true, message: "Posts retrieved", data: { posts, total, page: Number(page) } });
});

export const getUserTrips = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const trips = await Trip.find({ userId: id }).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
  const total = await Trip.countDocuments({ userId: id });

  sendResponse(res, { statusCode: 200, success: true, message: "Trips retrieved", data: { trips, total, page: Number(page) } });
});

export const getSavedPosts = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 12 } = req.query;
  const skip = (page - 1) * limit;

  const bookmarks = await Bookmark.find({ userId: req.user._id })
    .populate({ path: "postId", populate: { path: "userId", select: "name avatar" } })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const posts = bookmarks.filter((b) => b.postId).map((b) => b.postId);
  const total = await Bookmark.countDocuments({ userId: req.user._id });

  sendResponse(res, { statusCode: 200, success: true, message: "Saved posts retrieved", data: { posts, total, page: Number(page) } });
});

export const submitHelpTicket = catchAsync(async (req, res, next) => {
  const { subject, description } = req.body;
  if (!subject || !description) return next(new AppError(400, "Subject and description are required"));

  const ticket = await HelpTicket.create({ userId: req.user._id, subject, description });
  sendResponse(res, { statusCode: 201, success: true, message: "Help ticket submitted", data: ticket });
});
