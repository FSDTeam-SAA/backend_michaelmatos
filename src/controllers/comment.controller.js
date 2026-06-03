import catchAsync from "../utility/catchAsync.js";
import AppError from "../errors/appError.js";
import { sendResponse, createNotification } from "../utility/helper.js";
import { Comment } from "../models/comment.model.js";
import { Post } from "../models/post.model.js";
import { Like } from "../models/like.model.js";

export const getComments = catchAsync(async (req, res, next) => {
  const { postId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  // Top-level comments only
  const comments = await Comment.find({ postId, parentCommentId: null })
    .populate("userId", "name avatar")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Comment.countDocuments({ postId, parentCommentId: null });

  // Attach isLiked
  const commentIds = comments.map((c) => c._id);
  const likes = await Like.find({ userId: req.user._id, targetId: { $in: commentIds }, targetType: "comment" });
  const likedSet = new Set(likes.map((l) => l.targetId.toString()));

  const enriched = comments.map((c) => ({ ...c.toObject(), isLiked: likedSet.has(c._id.toString()) }));

  sendResponse(res, { statusCode: 200, success: true, message: "Comments retrieved", data: { comments: enriched, total, page: Number(page) } });
});

export const getReplies = catchAsync(async (req, res, next) => {
  const { commentId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const replies = await Comment.find({ parentCommentId: commentId })
    .populate("userId", "name avatar")
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Comment.countDocuments({ parentCommentId: commentId });
  sendResponse(res, { statusCode: 200, success: true, message: "Replies retrieved", data: { replies, total } });
});

export const addComment = catchAsync(async (req, res, next) => {
  const { postId, text, parentCommentId } = req.body;
  if (!postId || !text) return next(new AppError(400, "postId and text are required"));

  const post = await Post.findById(postId);
  if (!post) return next(new AppError(404, "Post not found"));

  let parentComment = null;
  if (parentCommentId) {
    parentComment = await Comment.findById(parentCommentId);
    if (!parentComment) return next(new AppError(404, "Parent comment not found"));
  }

  const comment = await Comment.create({
    postId,
    userId: req.user._id,
    text,
    parentCommentId: parentCommentId || null,
  });

  await comment.populate("userId", "name avatar");

  if (parentCommentId && parentComment) {
    await Comment.findByIdAndUpdate(parentCommentId, { $inc: { repliesCount: 1 } });
    // Notify parent comment author
    if (!parentComment.userId.equals(req.user._id)) {
      await createNotification(parentComment.userId, `${req.user.name} replied to your comment`, "new-comment", {
        relatedId: post._id,
        relatedType: "post",
      });
    }
  } else {
    await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });
    if (!post.userId.equals(req.user._id)) {
      await createNotification(post.userId, `${req.user.name} commented on your post`, "new-comment", {
        relatedId: post._id,
        relatedType: "post",
      });
    }
  }

  sendResponse(res, { statusCode: 201, success: true, message: "Comment added", data: comment });
});

export const deleteComment = catchAsync(async (req, res, next) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) return next(new AppError(404, "Comment not found"));
  if (!comment.userId.equals(req.user._id) && req.user.accountType !== "admin")
    return next(new AppError(403, "Access denied"));

  if (comment.parentCommentId) {
    await Comment.findByIdAndUpdate(comment.parentCommentId, { $inc: { repliesCount: -1 } });
  } else {
    await Post.findByIdAndUpdate(comment.postId, { $inc: { commentsCount: -1 } });
    // Delete all replies
    await Comment.deleteMany({ parentCommentId: comment._id });
  }

  await comment.deleteOne();
  sendResponse(res, { statusCode: 200, success: true, message: "Comment deleted", data: null });
});

export const likeComment = catchAsync(async (req, res, next) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) return next(new AppError(404, "Comment not found"));

  const existing = await Like.findOne({ userId: req.user._id, targetId: comment._id, targetType: "comment" });
  if (existing) {
    await existing.deleteOne();
    await Comment.findByIdAndUpdate(comment._id, { $inc: { likesCount: -1 } });
    return sendResponse(res, { statusCode: 200, success: true, message: "Comment unliked", data: { liked: false } });
  }

  await Like.create({ userId: req.user._id, targetId: comment._id, targetType: "comment" });
  await Comment.findByIdAndUpdate(comment._id, { $inc: { likesCount: 1 } });

  sendResponse(res, { statusCode: 200, success: true, message: "Comment liked", data: { liked: true } });
});
