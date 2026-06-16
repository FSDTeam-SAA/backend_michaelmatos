import catchAsync from "../utility/catchAsync.js";
import AppError from "../errors/appError.js";
import { sendResponse, uploadOnCloudinary } from "../utility/helper.js";
import { Trip } from "../models/trip.model.js";
import { Place } from "../models/place.model.js";
import { User } from "../models/user.model.js";
import { findMatchingPlace, findOrCreatePlace } from "../services/place.service.js";
import { parseLocationInput, withNormalizedLocation } from "../utility/location.js";

export const createTrip = catchAsync(async (req, res, next) => {
  const { tripName, fromDate, toDate, tripType, country } = req.body;
  const locationInput = parseLocationInput(req.body);
  console.log(
    `[create-trip] called tripName="${tripName || ""}" location="${locationInput.name}" lat=${locationInput.latitude ?? ""} lng=${locationInput.longitude ?? ""}`
  );

  if (!tripName || !locationInput.name || !locationInput.hasValidCoordinates || !fromDate || !toDate)
    return next(new AppError(400, "tripName, locationName, longitude, latitude, fromDate, toDate are required"));

  if (new Date(toDate) < new Date(fromDate))
    return next(new AppError(400, "toDate must be after fromDate"));

  let coverImageUrl = "";
  if (req.file) {
    const result = await uploadOnCloudinary(req.file.buffer, { folder: "travel/trips" });
    coverImageUrl = result.secure_url;
  }

  // Find or create the place and increment tripCount
  const place = await findOrCreatePlace({
    name: locationInput.name,
    longitude: locationInput.longitude,
    latitude: locationInput.latitude,
    placeType: tripType || "city",
    country,
    tripImage: coverImageUrl,
    radius: 5000,
  });

  // Determine initial status
  const now = new Date();
  const from = new Date(fromDate);
  const to = new Date(toDate);
  let status = "upcoming";
  if (now >= from && now <= to) status = "ongoing";
  else if (now > to) status = "completed";

  const trip = await Trip.create({
    userId: req.user._id,
    coverImage: coverImageUrl,
    tripName,
    location: {
      name: locationInput.name,
      latitude: locationInput.latitude,
      longitude: locationInput.longitude,
      coordinates: locationInput.coordinates,
    },
    placeId: place._id,
    fromDate: from,
    toDate: to,
    tripType: tripType || "city",
    status,
  });

  await User.findByIdAndUpdate(req.user._id, { $inc: { tripsCount: 1 } });

  sendResponse(res, { statusCode: 201, success: true, message: "Trip created successfully", data: withNormalizedLocation(trip) });
});

export const getMyTrips = catchAsync(async (req, res, next) => {
  const { status, page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const filter = { userId: req.user._id };
  if (status && status !== "all") filter.status = status;

  const trips = await Trip.find(filter)
    .populate("placeId", "name coverImage rating")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Trip.countDocuments(filter);

  // Stats
  const [ongoingCount, upcomingCount, completedCount] = await Promise.all([
    Trip.countDocuments({ userId: req.user._id, status: "ongoing" }),
    Trip.countDocuments({ userId: req.user._id, status: "upcoming" }),
    Trip.countDocuments({ userId: req.user._id, status: "completed" }),
  ]);

  const normalizedTrips = trips.map(withNormalizedLocation);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Trips retrieved",
    data: { trips: normalizedTrips, total, page: Number(page), stats: { ongoing: ongoingCount, upcoming: upcomingCount, completed: completedCount } },
  });
});

export const getTripById = catchAsync(async (req, res, next) => {
  const trip = await Trip.findById(req.params.id).populate("placeId").populate("userId", "name avatar");
  if (!trip) return next(new AppError(404, "Trip not found"));
  if (!trip.userId._id.equals(req.user._id) && req.user.accountType !== "admin")
    return next(new AppError(403, "Access denied"));

  sendResponse(res, { statusCode: 200, success: true, message: "Trip retrieved", data: withNormalizedLocation(trip) });
});

export const updateTrip = catchAsync(async (req, res, next) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) return next(new AppError(404, "Trip not found"));
  if (!trip.userId.equals(req.user._id)) return next(new AppError(403, "Access denied"));

  const { tripName, tripType, fromDate, toDate } = req.body;
  if (tripName) trip.tripName = tripName;
  if (tripType) trip.tripType = tripType;
  if (fromDate) trip.fromDate = new Date(fromDate);
  if (toDate) trip.toDate = new Date(toDate);

  if (req.file) {
    const result = await uploadOnCloudinary(req.file.buffer, { folder: "travel/trips" });
    trip.coverImage = result.secure_url;
  }

  await trip.save();
  sendResponse(res, { statusCode: 200, success: true, message: "Trip updated", data: trip });
});

export const deleteTrip = catchAsync(async (req, res, next) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) return next(new AppError(404, "Trip not found"));
  if (!trip.userId.equals(req.user._id) && req.user.accountType !== "admin")
    return next(new AppError(403, "Access denied"));

  // Decrement tripCount on place
  const matchingPlace = trip.placeId
    ? await Place.findById(trip.placeId)
    : await findMatchingPlace({
        name: trip.location?.name,
        longitude: trip.location?.longitude,
        latitude: trip.location?.latitude,
        radius: 5000,
      });
  if (matchingPlace) {
    matchingPlace.tripCount = Math.max(0, (matchingPlace.tripCount || 0) - 1);
    if (trip.coverImage) {
      matchingPlace.images = matchingPlace.images.filter((image) => image !== trip.coverImage);
      if (matchingPlace.coverImage === trip.coverImage) {
        matchingPlace.coverImage = matchingPlace.images[0] || "";
      }
    }
    await matchingPlace.save();
    console.log(`[delete-trip] decremented place id=${matchingPlace._id} name="${matchingPlace.name}" tripCount=${matchingPlace.tripCount}`);
  }

  await trip.deleteOne();
  await User.findByIdAndUpdate(trip.userId, { $inc: { tripsCount: -1 } });

  sendResponse(res, { statusCode: 200, success: true, message: "Trip deleted", data: null });
});
