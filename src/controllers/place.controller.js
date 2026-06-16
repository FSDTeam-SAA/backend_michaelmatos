import catchAsync from "../utility/catchAsync.js";
import AppError from "../errors/appError.js";
import { sendResponse } from "../utility/helper.js";
import { Place } from "../models/place.model.js";
import { Trip } from "../models/trip.model.js";
import { Post } from "../models/post.model.js";
import { Review } from "../models/review.model.js";
import { PlaceBookmark } from "../models/placeBookmark.model.js";

const RELATED_RADIUS_METERS = 5000;
const RELATED_LIMIT = 50;

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
  console.log("[trending-places] called");
  const places = await Place.find().sort({ tripCount: -1 }).limit(Number(limit));
  const enriched = await attachPlaceBookmarks(places, req.user._id);
  console.log(
    `[trending-places] count=${places.length} top=${places
      .slice(0, 5)
      .map((place) => `${place.name}:${place.tripCount || 0}`)
      .join(", ")}`
  );
  sendResponse(res, { statusCode: 200, success: true, message: "Trending places retrieved", data: enriched });
}

export async function getPlaceByIdHandler(req, res, next) {
  const place = await Place.findById(req.params.id);
  if (!place) return next(new AppError(404, "Place not found"));

  // Increment view count
  await Place.findByIdAndUpdate(place._id, { $inc: { viewCount: 1 } });

  // Reviews with average rating
  const reviews = await Review.find({ placeId: place._id })
    .populate("userId", "name avatar")
    .sort({ createdAt: -1 })
    .limit(5);

  const bookmarked = await PlaceBookmark.findOne({ userId: req.user._id, placeId: place._id });
  const normalizedPlace = normalizePlaceCoordinates(place);
  const related = await buildPlaceDetailsRelatedData(normalizedPlace, req.user._id);

  console.log(
    `[place-details] id=${place._id} name="${place.name}" location="${related.locationName}" lat=${related.latitude ?? ""} lng=${related.longitude ?? ""} nearbyPlaces=${related.nearbyCounts.places} nearbyTrips=${related.nearbyCounts.trips} nearbyPosts=${related.nearbyCounts.posts} sameLocation=${related.sameLocationCount} within5km=${related.withinRadiusCount} gallery=${related.images.length} otherPlaces=${related.otherPlaces.length} first=${related.otherPlaces
      .slice(0, 5)
      .map((item) => `${item.name}:${item.sourceType}`)
      .join(", ")} strategy="${related.matchingStrategy}"`
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Place details retrieved",
    data: {
      place: { ...normalizedPlace, isBookmarked: !!bookmarked },
      images: related.images,
      galleryImages: related.galleryImages,
      otherPlaces: related.otherPlaces,
      otherPlacesLocationName: related.locationName,
      nearbyPlaces: related.nearbyPlaces,
      reviews,
    },
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

async function buildPlaceDetailsRelatedData(place, userId) {
  const coordinates = getCoordinates(place);
  const locationName = displayLocationName(place);
  const rawLocationValues = locationMatchValues(place, locationName);
  const normalizedLocationKeys = rawLocationValues.map(normalizeLocationKey).filter(Boolean);
  const locationRegexes = rawLocationValues.map(locationRegex).filter(Boolean);

  const radiusRange = coordinates ? coordinateRange(coordinates) : null;
  const [
    nearbyPlacesByGeo,
    nearbyTripsByGeo,
    nearbyPostsByGeo,
    nearbyPlacesByLatLng,
    nearbyTripsByLatLng,
    nearbyPostsByLatLng,
  ] = coordinates
    ? await Promise.all([
        Place.find({
          _id: { $ne: place._id },
          location: {
            $near: {
              $geometry: { type: "Point", coordinates },
              $maxDistance: RELATED_RADIUS_METERS,
            },
          },
        }).limit(RELATED_LIMIT),
        Trip.find({
          "location.coordinates": {
            $near: {
              $geometry: { type: "Point", coordinates },
              $maxDistance: RELATED_RADIUS_METERS,
            },
          },
        }).limit(RELATED_LIMIT),
        Post.find({
          isPrivate: false,
          "location.coordinates": {
            $near: {
              $geometry: { type: "Point", coordinates },
              $maxDistance: RELATED_RADIUS_METERS,
            },
          },
        }).limit(RELATED_LIMIT),
        Place.find({
          _id: { $ne: place._id },
          latitude: { $gte: radiusRange.minLat, $lte: radiusRange.maxLat },
          longitude: { $gte: radiusRange.minLng, $lte: radiusRange.maxLng },
        }).limit(RELATED_LIMIT),
        Trip.find({
          "location.latitude": { $gte: radiusRange.minLat, $lte: radiusRange.maxLat },
          "location.longitude": { $gte: radiusRange.minLng, $lte: radiusRange.maxLng },
        }).limit(RELATED_LIMIT),
        Post.find({
          isPrivate: false,
          "location.latitude": { $gte: radiusRange.minLat, $lte: radiusRange.maxLat },
          "location.longitude": { $gte: radiusRange.minLng, $lte: radiusRange.maxLng },
        }).limit(RELATED_LIMIT),
      ])
    : [[], [], [], [], [], []];

  const nearbyPlaces = filterWithinRadius(mergeDocs(nearbyPlacesByGeo, nearbyPlacesByLatLng), coordinates);
  const nearbyTrips = filterWithinRadius(mergeDocs(nearbyTripsByGeo, nearbyTripsByLatLng), coordinates);
  const nearbyPosts = filterWithinRadius(mergeDocs(nearbyPostsByGeo, nearbyPostsByLatLng), coordinates);

  const [namedPlacesCandidates, namedTripsCandidates, namedPostsCandidates] = locationRegexes.length
    ? await Promise.all([
        Place.find({
          _id: { $ne: place._id },
          $or: [{ name: { $in: locationRegexes } }, { country: { $in: locationRegexes } }],
        }).limit(RELATED_LIMIT),
        Trip.find({ "location.name": { $in: locationRegexes } }).limit(RELATED_LIMIT),
        Post.find({ isPrivate: false, "location.name": { $in: locationRegexes } }).limit(RELATED_LIMIT),
      ])
    : [[], [], []];

  const namedPlaces = namedPlacesCandidates.filter((doc) => matchesLocation(doc, normalizedLocationKeys));
  const namedTrips = namedTripsCandidates.filter((doc) => matchesLocation(doc, normalizedLocationKeys));
  const namedPosts = namedPostsCandidates.filter((doc) => matchesLocation(doc, normalizedLocationKeys));

  const placeDocs = mergeDocs(nearbyPlaces, namedPlaces);
  const tripDocs = mergeDocs(nearbyTrips, namedTrips);
  const postDocs = mergeDocs(nearbyPosts, namedPosts);

  const images = buildGalleryImages({ place, trips: tripDocs, posts: postDocs });
  const otherPlaces = buildOtherPlaces({
    currentPlace: place,
    coordinates,
    normalizedLocationKeys,
    nearbyPlaces,
    namedPlaces,
    nearbyTrips,
    namedTrips,
    nearbyPosts,
    namedPosts,
  });

  const nearbyPlaceDocs = otherPlaces.filter((item) => item.sourceType === "place");
  const nearbyPlaceIds = nearbyPlaceDocs.map((item) => item._id);
  const nearbyPlaceModels = nearbyPlaceIds.length
    ? await attachPlaceBookmarks(await Place.find({ _id: { $in: nearbyPlaceIds } }), userId)
    : [];
  const nearbyPlaceOrder = new Map(nearbyPlaceIds.map((id, index) => [id.toString(), index]));
  nearbyPlaceModels.sort(
    (a, b) => (nearbyPlaceOrder.get(a._id.toString()) ?? 0) - (nearbyPlaceOrder.get(b._id.toString()) ?? 0)
  );

  const hasRadiusMatches = nearbyPlaces.length + nearbyTrips.length + nearbyPosts.length > 0;
  const hasNameMatches = namedPlaces.length + namedTrips.length + namedPosts.length > 0;
  const matchingStrategy = coordinates
    ? hasRadiusMatches
      ? hasNameMatches
        ? "5 km radius + same location name"
        : "5 km radius"
      : hasNameMatches
      ? "same location name"
      : "none"
    : hasNameMatches
    ? "same location name"
    : "none";

  return {
    locationName,
    latitude: coordinates?.[1],
    longitude: coordinates?.[0],
    images,
    galleryImages: images.map((item) => item.imageUrl),
    otherPlaces,
    nearbyPlaces: nearbyPlaceModels,
    nearbyCounts: {
      places: nearbyPlaces.length,
      trips: nearbyTrips.length,
      posts: nearbyPosts.length,
    },
    sameLocationCount: namedPlaces.length + namedTrips.length + namedPosts.length,
    withinRadiusCount: hasRadiusMatches ? nearbyPlaces.length + nearbyTrips.length + nearbyPosts.length : 0,
    matchingStrategy,
  };
}

function buildGalleryImages({ place, trips, posts }) {
  const seen = new Set();
  const images = [];
  const addImage = ({ imageUrl, sourceType, sourceId, title, locationText }) => {
    const cleanUrl = (imageUrl || "").toString().trim();
    if (!cleanUrl || seen.has(cleanUrl)) return;
    seen.add(cleanUrl);
    images.push({
      imageUrl: cleanUrl,
      sourceType,
      sourceId: sourceId?.toString() || "",
      title: title || "",
      locationText: locationText || "",
    });
  };

  addImage({
    imageUrl: place.coverImage,
    sourceType: "place",
    sourceId: place._id,
    title: place.name,
    locationText: displayLocationName(place),
  });
  for (const image of place.images || []) {
    addImage({
      imageUrl: image,
      sourceType: "place",
      sourceId: place._id,
      title: place.name,
      locationText: displayLocationName(place),
    });
  }
  for (const trip of trips) {
    const data = toObject(trip);
    addImage({
      imageUrl: data.coverImage,
      sourceType: "trip",
      sourceId: data._id,
      title: data.tripName,
      locationText: data.location?.name || "",
    });
  }
  for (const post of posts) {
    const data = toObject(post);
    for (const image of data.images || []) {
      addImage({
        imageUrl: image,
        sourceType: "post",
        sourceId: data._id,
        title: postTitle(data),
        locationText: data.location?.name || "",
      });
    }
  }

  return images;
}

function buildOtherPlaces({
  currentPlace,
  coordinates,
  normalizedLocationKeys,
  nearbyPlaces,
  namedPlaces,
  nearbyTrips,
  namedTrips,
  nearbyPosts,
  namedPosts,
}) {
  const seenBySource = new Set();
  const cards = [];

  const addCard = (card) => {
    if (!card || !card._id || !card.name) return;
    const sourceKey = `${card.sourceType}:${card.sourceId || card._id}`;
    if (seenBySource.has(sourceKey)) return;
    seenBySource.add(sourceKey);
    cards.push(card);
  };

  for (const place of nearbyPlaces) addCard(placeCard(place, coordinates, "radius"));
  for (const trip of nearbyTrips) addCard(tripCard(trip, coordinates, "radius"));
  for (const post of nearbyPosts) addCard(postCard(post, coordinates, "radius"));
  for (const place of namedPlaces) {
    if (matchesLocation(place, normalizedLocationKeys)) {
      addCard(placeCard(place, coordinates, "name"));
    }
  }
  for (const trip of namedTrips) {
    if (matchesLocation(trip, normalizedLocationKeys)) {
      addCard(tripCard(trip, coordinates, "name"));
    }
  }
  for (const post of namedPosts) {
    if (matchesLocation(post, normalizedLocationKeys)) {
      addCard(postCard(post, coordinates, "name"));
    }
  }

  return cards
    .filter((card) => card.sourceType !== "place" || card._id.toString() !== currentPlace._id.toString())
    .sort((a, b) => {
      if (a.matchingStrategy !== b.matchingStrategy) {
        return a.matchingStrategy === "radius" ? -1 : 1;
      }
      if (a.distanceKm !== undefined && b.distanceKm !== undefined) return a.distanceKm - b.distanceKm;
      if (a.distanceKm !== undefined) return -1;
      if (b.distanceKm !== undefined) return 1;
      return a.name.localeCompare(b.name);
    });
}

function placeCard(place, currentCoordinates, matchingStrategy) {
  const data = normalizePlaceCoordinates(place);
  const coordinates = getCoordinates(data);
  return {
    _id: data._id?.toString() || "",
    sourceId: data._id?.toString() || "",
    placeId: data._id?.toString() || "",
    sourceType: "place",
    name: data.name || "",
    locationText: displayLocationName(data),
    category: data.placeType || "",
    coverImage: data.coverImage || firstImage(data.images),
    latitude: coordinates?.[1],
    longitude: coordinates?.[0],
    distanceKm: distanceKm(currentCoordinates, coordinates),
    matchingStrategy,
  };
}

function tripCard(trip, currentCoordinates, matchingStrategy) {
  const data = toObject(trip);
  const coordinates = getCoordinates(data);
  return {
    _id: data._id?.toString() || "",
    sourceId: data._id?.toString() || "",
    placeId: data.placeId?.toString() || "",
    sourceType: "trip",
    name: data.tripName || data.location?.name || "Trip",
    locationText: data.location?.name || "",
    category: data.tripType || "",
    coverImage: data.coverImage || "",
    latitude: coordinates?.[1],
    longitude: coordinates?.[0],
    distanceKm: distanceKm(currentCoordinates, coordinates),
    matchingStrategy,
  };
}

function postCard(post, currentCoordinates, matchingStrategy) {
  const data = toObject(post);
  const coordinates = getCoordinates(data);
  const locationText = data.location?.name || "";
  return {
    _id: data._id?.toString() || "",
    sourceId: data._id?.toString() || "",
    placeId: "",
    sourceType: "post",
    name: postTitle(data) || (locationText ? `Post in ${locationText}` : "Post"),
    locationText,
    category: data.placeType || "",
    coverImage: firstImage(data.images),
    latitude: coordinates?.[1],
    longitude: coordinates?.[0],
    distanceKm: distanceKm(currentCoordinates, coordinates),
    matchingStrategy,
  };
}

function matchesLocation(doc, normalizedLocationKeys) {
  if (!normalizedLocationKeys.length) return false;
  const data = toObject(doc);
  const values = [
    data.name,
    data.country,
    data.city,
    data.location?.name,
    data.location?.city,
    data.location?.country,
  ];
  return values.some((value) => normalizedLocationMatches(normalizedLocationKeys, value));
}

function getCoordinates(doc) {
  const data = toObject(doc);
  const location = data.location || {};
  const rawCoordinates = Array.isArray(location.coordinates?.coordinates)
    ? location.coordinates.coordinates
    : Array.isArray(location.coordinates)
    ? location.coordinates
    : [];
  const longitude = parseCoordinate(data.longitude ?? location.longitude ?? rawCoordinates[0]);
  const latitude = parseCoordinate(data.latitude ?? location.latitude ?? rawCoordinates[1]);
  return isValidCoordinates(latitude, longitude) ? [longitude, latitude] : null;
}

function distanceKm(fromCoordinates, toCoordinates) {
  if (!fromCoordinates || !toCoordinates) return undefined;
  return Number(haversineDistanceKm(fromCoordinates, toCoordinates).toFixed(1));
}

function haversineDistanceKm(fromCoordinates, toCoordinates) {
  const [fromLng, fromLat] = fromCoordinates;
  const [toLng, toLat] = toCoordinates;
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latDiff = toRadians(toLat - fromLat);
  const lngDiff = toRadians(toLng - fromLng);
  const a =
    Math.sin(latDiff / 2) * Math.sin(latDiff / 2) +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(lngDiff / 2) *
      Math.sin(lngDiff / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function filterWithinRadius(docs, currentCoordinates) {
  if (!currentCoordinates) return [];
  return docs.filter((doc) => {
    const coordinates = getCoordinates(doc);
    if (!coordinates) return false;
    return haversineDistanceKm(currentCoordinates, coordinates) <= RELATED_RADIUS_METERS / 1000;
  });
}

function coordinateRange(coordinates) {
  const [longitude, latitude] = coordinates;
  const radiusKm = RELATED_RADIUS_METERS / 1000;
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01));
  return {
    minLat: latitude - latDelta,
    maxLat: latitude + latDelta,
    minLng: longitude - lngDelta,
    maxLng: longitude + lngDelta,
  };
}

function displayLocationName(place) {
  return firstString([place.name, place.country, place.location?.name, place.city]);
}

function locationMatchValues(place, locationName) {
  const primaryValues = uniqueStrings([place.name, place.location?.name, locationName]);
  const values = [];
  for (const value of primaryValues) {
    values.push(value);
    values.push(primaryLocationPart(value));
  }
  if (!values.length && place.country) values.push(place.country);
  return uniqueStrings(values);
}

function primaryLocationPart(value) {
  return (value || "").toString().split(",")[0].trim();
}

function normalizedLocationMatches(normalizedLocationKeys, value) {
  const candidate = normalizeLocationKey(value);
  if (!candidate) return false;
  return normalizedLocationKeys.some((key) => {
    if (!key) return false;
    return candidate === key || candidate.startsWith(`${key} `) || key.startsWith(`${candidate} `);
  });
}

function normalizeLocationKey(value) {
  return (value || "")
    .toString()
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function locationRegex(value) {
  const clean = primaryLocationPart(value);
  if (!clean) return null;
  return new RegExp(`^\\s*${flexibleLocationPattern(clean)}(?:\\s*,|\\s*$)`, "i");
}

function flexibleLocationPattern(value) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => escapeRegex(part).replace(/[’']/g, "[’']?"))
    .join("\\s+");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const clean = (value || "").toString().trim();
    const key = normalizeLocationKey(clean);
    if (!clean || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result;
}

function mergeDocs(...sources) {
  const seen = new Set();
  const result = [];
  for (const source of sources) {
    for (const doc of source) {
      const data = toObject(doc);
      const id = data._id?.toString();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      result.push(doc);
    }
  }
  return result;
}

function postTitle(post) {
  const caption = (post.caption || "").toString().trim();
  if (caption.length <= 48) return caption;
  return `${caption.slice(0, 45).trim()}...`;
}

function firstImage(images) {
  return Array.isArray(images) ? (images.find((image) => (image || "").toString().trim()) || "") : "";
}

function firstString(values) {
  for (const value of values) {
    const clean = (value || "").toString().trim();
    if (clean) return clean;
  }
  return "";
}

function parseCoordinate(value) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isValidCoordinates(latitude, longitude) {
  if (latitude === undefined || longitude === undefined) return false;
  if (latitude === 0 && longitude === 0) return false;
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function toObject(doc) {
  return typeof doc?.toObject === "function" ? doc.toObject() : doc || {};
}

export const getPlaces = catchAsync(getPlacesHandler);
export const getTrendingPlaces = catchAsync(getTrendingPlacesHandler);
export const getPlaceById = catchAsync(getPlaceByIdHandler);
export const bookmarkPlace = catchAsync(bookmarkPlaceHandler);
