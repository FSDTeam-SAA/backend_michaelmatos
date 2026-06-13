export const parseLocationInput = (body = {}) => {
  const location =
    body.location && typeof body.location === "object" ? body.location : {};
  const name = (
    location.name ??
    location.locationName ??
    body.locationName ??
    body.name ??
    ""
  )
    .toString()
    .trim();

  const latitude = parseCoordinate(
    location.latitude ?? location.lat ?? body.latitude ?? body.lat
  );
  const longitude = parseCoordinate(
    location.longitude ?? location.lng ?? location.lon ?? body.longitude ?? body.lng ?? body.lon
  );

  if (!isValidLatLng(latitude, longitude)) {
    return {
      name,
      latitude: undefined,
      longitude: undefined,
      coordinates: undefined,
      hasValidCoordinates: false,
    };
  }

  return {
    name,
    latitude,
    longitude,
    coordinates: { type: "Point", coordinates: [longitude, latitude] },
    hasValidCoordinates: true,
  };
};

export const normalizeLocationForResponse = (location = {}) => {
  const coordinates = Array.isArray(location.coordinates?.coordinates)
    ? location.coordinates.coordinates
    : Array.isArray(location.coordinates)
    ? location.coordinates
    : [];
  const longitude = parseCoordinate(location.longitude ?? coordinates[0]);
  const latitude = parseCoordinate(location.latitude ?? coordinates[1]);

  return {
    ...location,
    latitude: isValidLatLng(latitude, longitude) ? latitude : location.latitude,
    longitude: isValidLatLng(latitude, longitude) ? longitude : location.longitude,
  };
};

export const withNormalizedLocation = (doc) => {
  if (!doc) return doc;
  const data = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    ...data,
    location: normalizeLocationForResponse(data.location),
  };
};

export const parseCoordinate = (value) => {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const isValidLatLng = (latitude, longitude) => {
  if (latitude === undefined || longitude === undefined) return false;
  if (latitude === 0 && longitude === 0) return false;
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
};
