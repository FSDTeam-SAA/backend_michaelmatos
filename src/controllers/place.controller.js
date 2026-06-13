import catchAsync from "../utility/catchAsync.js";
import AppError from "../errors/appError.js";
import { sendResponse } from "../utility/helper.js";
import { Place } from "../models/place.model.js";
import { Review } from "../models/review.model.js";
import { PlaceBookmark } from "../models/placeBookmark.model.js";

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
  const enriched = await attachPlaceBookmarks(places, req.user._id);

  sendResponse(res, { statusCode: 200, success: true, message: "Places retrieved", data: { places: enriched, total, page: Number(page) } });
}

export async function getTrendingPlacesHandler(req, res, next) {
  const { limit = 10 } = req.query;
  const places = await Place.find().sort({ tripCount: -1 }).limit(Number(limit));
  const enriched = await attachPlaceBookmarks(places, req.user._id);
  sendResponse(res, { statusCode: 200, success: true, message: "Trending places retrieved", data: enriched });
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

  const bookmarked = await PlaceBookmark.findOne({ userId: req.user._id, placeId: place._id });
  const nearbyWithBookmarks = await attachPlaceBookmarks(nearbyPlaces, req.user._id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Place details retrieved",
    data: { place: { ...normalizePlaceCoordinates(place), isBookmarked: !!bookmarked }, galleryImages, nearbyPlaces: nearbyWithBookmarks, reviews },
  });
}

export async function bookmarkPlaceHandler(req, res, next) {
  const place = await Place.findById(req.params.id);
  if (!place) return next(new AppError(404, "Place not found"));

  const existing = await PlaceBookmark.findOne({ userId: req.user._id, placeId: place._id });
  if (existing) {
    await existing.deleteOne();
    return sendResponse(res, { statusCode: 200, success: true, message: "Place bookmark removed", data: { bookmarked: false } });
  }

  await PlaceBookmark.create({ userId: req.user._id, placeId: place._id });
  sendResponse(res, { statusCode: 200, success: true, message: "Place bookmarked", data: { bookmarked: true } });
}

async function attachPlaceBookmarks(places, userId) {
  const placeIds = places.map((place) => place._id);
  const bookmarks = await PlaceBookmark.find({ userId, placeId: { $in: placeIds } });
  const bookmarkedSet = new Set(bookmarks.map((bookmark) => bookmark.placeId.toString()));
  return places.map((place) => ({
    ...normalizePlaceCoordinates(place),
    isBookmarked: bookmarkedSet.has(place._id.toString()),
  }));
}

function normalizePlaceCoordinates(place) {
  const data = typeof place.toObject === "function" ? place.toObject() : place;
  const coordinates = Array.isArray(data.location?.coordinates) ? data.location.coordinates : [];
  const longitude = Number.isFinite(Number(data.longitude)) ? Number(data.longitude) : Number(coordinates[0]);
  const latitude = Number.isFinite(Number(data.latitude)) ? Number(data.latitude) : Number(coordinates[1]);
  return {
    ...data,
    latitude: Number.isFinite(latitude) ? latitude : data.latitude,
    longitude: Number.isFinite(longitude) ? longitude : data.longitude,
  };
}

export const getPlaces = catchAsync(getPlacesHandler);
export const getTrendingPlaces = catchAsync(getTrendingPlacesHandler);
export const getPlaceById = catchAsync(getPlaceByIdHandler);
export const bookmarkPlace = catchAsync(bookmarkPlaceHandler);
