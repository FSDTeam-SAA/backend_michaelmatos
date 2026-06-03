import catchAsync from "../utility/catchAsync.js";
import AppError from "../errors/appError.js";
import { sendResponse } from "../utility/helper.js";
import { Place } from "../models/place.model.js";
import { Review } from "../models/review.model.js";

export async function getPlacesHandler(req, res, next) {
  const { lat, lng, radius = 50000, type, filter, page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  let query = {};

  if (lat && lng) {
    query.location = {
      $near: {
        $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
        $maxDistance: parseFloat(radius),
      },
    };
  }

  if (type && type !== "all") query.placeType = type;

  // filter: "popular" = high viewCount, "tourist" = high tripCount
  let sortOption = { createdAt: -1 };
  if (filter === "popular") sortOption = { viewCount: -1 };
  if (filter === "tourist") sortOption = { tripCount: -1 };

  const places = await Place.find(query).sort(sortOption).skip(skip).limit(Number(limit));
  const total = await Place.countDocuments(query);

  sendResponse(res, { statusCode: 200, success: true, message: "Places retrieved", data: { places, total, page: Number(page) } });
}

export async function getTrendingPlacesHandler(req, res, next) {
  const { limit = 10 } = req.query;
  const places = await Place.find().sort({ tripCount: -1 }).limit(Number(limit));
  sendResponse(res, { statusCode: 200, success: true, message: "Trending places retrieved", data: places });
}

export async function getPlaceByIdHandler(req, res, next) {
  const place = await Place.findById(req.params.id);
  if (!place) return next(new AppError(404, "Place not found"));

  // Increment view count
  await Place.findByIdAndUpdate(place._id, { $inc: { viewCount: 1 } });

  const galleryImages = place.images.slice(0, 18);

  // Nearby places
  const nearbyPlaces = await Place.find({
    _id: { $ne: place._id },
    location: {
      $near: {
        $geometry: { type: "Point", coordinates: place.location.coordinates },
        $maxDistance: 100000,
      },
    },
  }).limit(6);

  // Reviews with average rating
  const reviews = await Review.find({ placeId: place._id })
    .populate("userId", "name avatar")
    .sort({ createdAt: -1 })
    .limit(5);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Place details retrieved",
    data: { place, galleryImages, nearbyPlaces, reviews },
  });
}

export const getPlaces = catchAsync(getPlacesHandler);
export const getTrendingPlaces = catchAsync(getTrendingPlacesHandler);
export const getPlaceById = catchAsync(getPlaceByIdHandler);
