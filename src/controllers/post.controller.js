import catchAsync from "../utility/catchAsync.js";
import AppError from "../errors/appError.js";
import { sendResponse, uploadOnCloudinary, createNotification } from "../utility/helper.js";
import { Post } from "../models/post.model.js";
import { Like } from "../models/like.model.js";
import { Bookmark } from "../models/bookmark.model.js";
import { Follow } from "../models/follow.model.js";
import { User } from "../models/user.model.js";
import { parseLocationInput, withNormalizedLocation } from "../utility/location.js";
import { findOrCreatePlace } from "../services/place.service.js";

export const createPost = catchAsync(async (req, res, next) => {
  const { caption, placeType } = req.body;
  const locationInput = parseLocationInput(req.body);

  if (!req.files || req.files.length === 0)
    return next(new AppError(400, "At least one image is required"));

  const imageUrls = await Promise.all(
    req.files.map((file) => uploadOnCloudinary(file.buffer, { folder: "travel/posts" }).then((r) => r.secure_url))
  );

  if (locationInput.hasValidCoordinates) {
    await findOrCreatePlace({
      name: locationInput.name || "Post location",
      longitude: locationInput.longitude,
      latitude: locationInput.latitude,
      placeType: placeType || "city",
      tripImage: imageUrls[0] || "",
      radius: 5000,
      incrementTripCount: false,
    });
  }

  const post = await Post.create({
    userId: req.user._id,
    caption,
    images: imageUrls,
    location: {
      name: locationInput.name,
      latitude: locationInput.latitude,
      longitude: locationInput.longitude,
      ...(locationInput.coordinates ? { coordinates: locationInput.coordinates } : {}),
    },
    placeType: placeType || "city",
  });

  await User.findByIdAndUpdate(req.user._id, { $inc: { postsCount: 1 } });

  // Notify followers
  const followers = await Follow.find({ followingId: req.user._id }).limit(100);
  for (const f of followers) {
    await createNotification(f.followerId, `${req.user.name} created a new post`, "new-post", {
      relatedId: post._id,
      relatedType: "post",
    });
  }

  sendResponse(res, { statusCode: 201, success: true, message: "Post created successfully", data: withNormalizedLocation(post) });
});

export const getFeed = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const following = await Follow.find({ followerId: req.user._id }).select("followingId");
  const followingIds = following.map((f) => f.followingId);
  followingIds.push(req.user._id);

  const posts = await Post.find({  isPrivate: false })
    .populate("userId", "name avatar location")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Post.countDocuments({ userId: { $in: followingIds }, isPrivate: false });

  // Attach isLiked and isBookmarked for current user
  const postIds = posts.map((p) => p._id);
  const [likes, bookmarks] = await Promise.all([
    Like.find({ userId: req.user._id, targetId: { $in: postIds }, targetType: "post" }),
    Bookmark.find({ userId: req.user._id, postId: { $in: postIds } }),
  ]);
  const likedSet = new Set(likes.map((l) => l.targetId.toString()));
  const bookmarkedSet = new Set(bookmarks.map((b) => b.postId.toString()));

  const enriched = posts.map((p) => ({
    ...withNormalizedLocation(p),
    isLiked: likedSet.has(p._id.toString()),
    isBookmarked: bookmarkedSet.has(p._id.toString()),
  }));

  sendResponse(res, { statusCode: 200, success: true, message: "Feed retrieved", data: { posts: enriched, total, page: Number(page) } });
});

export const getPostById = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id).populate("userId", "name avatar location");
  if (!post) return next(new AppError(404, "Post not found"));
  if (post.isPrivate && !post.userId._id.equals(req.user._id))
    return next(new AppError(403, "This post is private"));

  const [liked, bookmarked] = await Promise.all([
    Like.findOne({ userId: req.user._id, targetId: post._id, targetType: "post" }),
    Bookmark.findOne({ userId: req.user._id, postId: post._id }),
  ]);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Post retrieved",
    data: { ...withNormalizedLocation(post), isLiked: !!liked, isBookmarked: !!bookmarked },
  });
});

export const updatePost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);
  if (!post) return next(new AppError(404, "Post not found"));
  if (!post.userId.equals(req.user._id)) return next(new AppError(403, "Access denied"));

  const { caption, placeType } = req.body;
  if (caption !== undefined) post.caption = caption;
  if (placeType) post.placeType = placeType;
  await post.save();

  sendResponse(res, { statusCode: 200, success: true, message: "Post updated", data: post });
});

export const makePostPrivate = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);
  if (!post) return next(new AppError(404, "Post not found"));
  if (!post.userId.equals(req.user._id)) return next(new AppError(403, "Access denied"));

  post.isPrivate = !post.isPrivate;
  await post.save();

  sendResponse(res, { statusCode: 200, success: true, message: `Post is now ${post.isPrivate ? "private" : "public"}`, data: { isPrivate: post.isPrivate } });
});

export const deletePost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);
  if (!post) return next(new AppError(404, "Post not found"));
  if (!post.userId.equals(req.user._id) && req.user.accountType !== "admin")
    return next(new AppError(403, "Access denied"));

  await post.deleteOne();
  await User.findByIdAndUpdate(post.userId, { $inc: { postsCount: -1 } });

  sendResponse(res, { statusCode: 200, success: true, message: "Post deleted", data: null });
});

export const likePost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);
  if (!post) return next(new AppError(404, "Post not found"));

  const existing = await Like.findOne({ userId: req.user._id, targetId: post._id, targetType: "post" });
  if (existing) {
    await existing.deleteOne();
    await Post.findByIdAndUpdate(post._id, { $inc: { likesCount: -1 } });
    return sendResponse(res, { statusCode: 200, success: true, message: "Post unliked", data: { liked: false } });
  }

  await Like.create({ userId: req.user._id, targetId: post._id, targetType: "post" });
  await Post.findByIdAndUpdate(post._id, { $inc: { likesCount: 1 } });

  if (!post.userId.equals(req.user._id)) {
    await createNotification(post.userId, `${req.user.name} liked your post`, "new-like", {
      relatedId: post._id,
      relatedType: "post",
    });
  }

  sendResponse(res, { statusCode: 200, success: true, message: "Post liked", data: { liked: true } });
});

export const getPostLikes = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const likes = await Like.find({ targetId: req.params.id, targetType: "post" })
    .populate("userId", "name avatar")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Like.countDocuments({ targetId: req.params.id, targetType: "post" });
  sendResponse(res, { statusCode: 200, success: true, message: "Likes retrieved", data: { likes: likes.map((l) => l.userId), total } });
});

export const bookmarkPost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);
  if (!post) return next(new AppError(404, "Post not found"));

  const existing = await Bookmark.findOne({ userId: req.user._id, postId: post._id });
  if (existing) {
    await existing.deleteOne();
    await Post.findByIdAndUpdate(post._id, { $inc: { bookmarksCount: -1 } });
    return sendResponse(res, { statusCode: 200, success: true, message: "Bookmark removed", data: { bookmarked: false } });
  }

  await Bookmark.create({ userId: req.user._id, postId: post._id });
  await Post.findByIdAndUpdate(post._id, { $inc: { bookmarksCount: 1 } });

  sendResponse(res, { statusCode: 200, success: true, message: "Post bookmarked", data: { bookmarked: true } });
});
