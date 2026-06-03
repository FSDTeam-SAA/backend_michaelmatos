import { Place } from "../models/place.model.js";

export const findOrCreatePlace = async ({
  name,
  longitude,
  latitude,
  placeType,
  country,
  tripImage = "",
  radius = 200,
}) => {
  const parsedLongitude = parseFloat(longitude);
  const parsedLatitude = parseFloat(latitude);

  const existing = await Place.findOne({
    location: {
      $near: {
        $geometry: { type: "Point", coordinates: [parsedLongitude, parsedLatitude] },
        $maxDistance: radius,
      },
    },
  });

  if (existing) {
    existing.tripCount += 1;
    if (tripImage) {
      if (!existing.coverImage) existing.coverImage = tripImage;
      if (!existing.images.includes(tripImage)) existing.images.push(tripImage);
    }
    await existing.save();
    return existing;
  }

  return Place.create({
    name,
    placeType: placeType || "city",
    country: country || "",
    location: { type: "Point", coordinates: [parsedLongitude, parsedLatitude] },
    tripCount: 1,
    coverImage: tripImage || "",
    images: tripImage ? [tripImage] : [],
  });
};
