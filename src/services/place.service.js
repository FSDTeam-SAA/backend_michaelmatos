import { Place } from "../models/place.model.js";

const DEFAULT_PLACE_MATCH_RADIUS_METERS = 5000;

export const findOrCreatePlace = async ({
  name,
  longitude,
  latitude,
  placeType,
  country,
  tripImage = "",
  radius = DEFAULT_PLACE_MATCH_RADIUS_METERS,
  incrementTripCount = true,
}) => {
  const parsedLongitude = parseFloat(longitude);
  const parsedLatitude = parseFloat(latitude);
  const hasValidCoordinates = isValidCoordinates(parsedLatitude, parsedLongitude);

  const existing = await findMatchingPlace({
    name,
    country,
    longitude: parsedLongitude,
    latitude: parsedLatitude,
    radius,
  });

  if (existing) {
    if (incrementTripCount) existing.tripCount = Math.max(0, (existing.tripCount || 0) + 1);
    if (hasValidCoordinates) {
      existing.location = { type: "Point", coordinates: [parsedLongitude, parsedLatitude] };
      existing.latitude = parsedLatitude;
      existing.longitude = parsedLongitude;
    }
    if (!existing.placeType && placeType) existing.placeType = placeType;
    if (!existing.country && country) existing.country = country;
    if (tripImage) {
      if (!existing.coverImage) existing.coverImage = tripImage;
      if (!existing.images.includes(tripImage)) existing.images.push(tripImage);
    }
    await existing.save();
    console.log(
      `[create-trip-place] matched place id=${existing._id} name="${existing.name}" tripCount=${existing.tripCount}`
    );
    return existing;
  }

  const place = await Place.create({
    name,
    placeType: placeType || "city",
    country: country || "",
    location: { type: "Point", coordinates: [parsedLongitude, parsedLatitude] },
    latitude: parsedLatitude,
    longitude: parsedLongitude,
    tripCount: incrementTripCount ? 1 : 0,
    coverImage: tripImage || "",
    images: tripImage ? [tripImage] : [],
  });
  console.log(`[create-trip-place] created place id=${place._id} name="${place.name}" tripCount=${place.tripCount}`);
  return place;
};

export const findMatchingPlace = async ({ name, country, longitude, latitude, radius = DEFAULT_PLACE_MATCH_RADIUS_METERS }) => {
  const locationRegexes = locationMatchValues({ name, country }).map(locationRegex).filter(Boolean);

  if (locationRegexes.length) {
    const candidates = await Place.find({
      $or: [{ name: { $in: locationRegexes } }, { country: { $in: locationRegexes } }],
    }).limit(20);
    const normalizedKeys = locationMatchValues({ name, country }).map(normalizeLocationKey).filter(Boolean);
    const namedMatch = candidates.find((place) => matchesLocation(place, normalizedKeys));
    if (namedMatch) return namedMatch;
  }

  if (isValidCoordinates(latitude, longitude)) {
    const geoMatch = await Place.findOne({
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [longitude, latitude] },
          $maxDistance: radius,
        },
      },
    });
    if (geoMatch) return geoMatch;

    const range = coordinateRange([longitude, latitude], radius);
    const candidates = await Place.find({
      latitude: { $gte: range.minLat, $lte: range.maxLat },
      longitude: { $gte: range.minLng, $lte: range.maxLng },
    }).limit(20);
    return candidates.find((place) => {
      const placeCoordinates = getCoordinates(place);
      return placeCoordinates && haversineDistanceKm([longitude, latitude], placeCoordinates) <= radius / 1000;
    });
  }

  return null;
};

function matchesLocation(doc, normalizedLocationKeys) {
  const data = typeof doc?.toObject === "function" ? doc.toObject() : doc || {};
  const values = [data.name, data.country, data.location?.name, data.location?.country];
  return values.some((value) => normalizedLocationMatches(normalizedLocationKeys, value));
}

function locationMatchValues({ name, country }) {
  const primaryValues = uniqueStrings([name, primaryLocationPart(name), country]);
  return uniqueStrings(primaryValues);
}

function primaryLocationPart(value) {
  return (value || "").toString().split(",")[0].trim();
}

function normalizedLocationMatches(normalizedLocationKeys, value) {
  const candidate = normalizeLocationKey(value);
  if (!candidate) return false;
  return normalizedLocationKeys.some((key) => candidate === key || candidate.startsWith(`${key} `) || key.startsWith(`${candidate} `));
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

function getCoordinates(doc) {
  const data = typeof doc?.toObject === "function" ? doc.toObject() : doc || {};
  const rawCoordinates = Array.isArray(data.location?.coordinates) ? data.location.coordinates : [];
  const longitude = Number.isFinite(Number(data.longitude)) ? Number(data.longitude) : Number(rawCoordinates[0]);
  const latitude = Number.isFinite(Number(data.latitude)) ? Number(data.latitude) : Number(rawCoordinates[1]);
  return isValidCoordinates(latitude, longitude) ? [longitude, latitude] : null;
}

function isValidCoordinates(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude === 0 && longitude === 0) return false;
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function coordinateRange(coordinates, radiusMeters) {
  const [longitude, latitude] = coordinates;
  const radiusKm = radiusMeters / 1000;
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01));
  return {
    minLat: latitude - latDelta,
    maxLat: latitude + latDelta,
    minLng: longitude - lngDelta,
    maxLng: longitude + lngDelta,
  };
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
