import catchAsync from "../utility/catchAsync.js";
import AppError from "../errors/appError.js";
import { sendResponse, uploadOnCloudinary } from "../utility/helper.js";
import { Review } from "../models/review.model.js";
import { Trip } from "../models/trip.model.js";
import { Place } from "../models/place.model.js";

export const createReview = catchAsync(async (req, res, next) => {
  const { tripId, rating, text } = req.body;

  if (!tripId || !rating) return next(new AppError(400, "tripId and rating are required"));
  if (rating < 1 || rating > 5) return next(new AppError(400, "Rating must be between 1 and 5"));

  const trip = await Trip.findById(tripId);
  if (!trip) return next(new AppError(404, "Trip not found"));
  if (!trip.userId.equals(req.user._id)) return next(new AppError(403, "Access denied"));
  if (trip.status !== "completed") return next(new AppError(400, "Can only review completed trips"));
  if (trip.reviewSubmitted) return next(new AppError(400, "Review already submitted for this trip"));

  const imageUrls = [];
  if (req.files && req.files.length > 0) {
    const uploaded = await Promise.all(
      req.files.map((f) => uploadOnCloudinary(f.buffer, { folder: "travel/reviews" }).then((r) => r.secure_url))
    );
    imageUrls.push(...uploaded);
  }

  const review = await Review.create({
    userId: req.user._id,
    tripId,
    placeId: trip.placeId,
    rating: Number(rating),
    text,
    images: imageUrls,
  });

  await Trip.findByIdAndUpdate(tripId, { reviewSubmitted: true });

  // Update place rating average
  const allReviews = await Review.find({ placeId: trip.placeId });
  const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
  await Place.findByIdAndUpdate(trip.placeId, { rating: Math.round(avgRating * 10) / 10, ratingCount: allReviews.length });

  await review.populate("userId", "name avatar");
  sendResponse(res, { statusCode: 201, success: true, message: "Review submitted", data: review });
});

export const getPlaceReviews = catchAsync(async (req, res, next) => {
  const { placeId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const reviews = await Review.find({ placeId })
    .populate("userId", "name avatar")
    .populate("tripId", "tripName")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Review.countDocuments({ placeId });
  sendResponse(res, { statusCode: 200, success: true, message: "Reviews retrieved", data: { reviews, total, page: Number(page) } });
});

export const getMyReviews = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const reviews = await Review.find({ userId: req.user._id })
    .populate("placeId", "name coverImage")
    .populate("tripId", "tripName")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Review.countDocuments({ userId: req.user._id });
  sendResponse(res, { statusCode: 200, success: true, message: "My reviews retrieved", data: { reviews, total, page: Number(page) } });
});

export const deleteReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);
  if (!review) return next(new AppError(404, "Review not found"));
  if (!review.userId.equals(req.user._id) && req.user.accountType !== "admin")
    return next(new AppError(403, "Access denied"));

  await review.deleteOne();
  sendResponse(res, { statusCode: 200, success: true, message: "Review deleted", data: null });
});
