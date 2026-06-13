import mongoose from "mongoose";

const placeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    placeType: {
      type: String,
      enum: ["city", "beach", "mountains", "nature", "culture", "food"],
      default: "city",
    },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [longitude, latitude]
    },
    latitude: { type: Number, default: undefined },
    longitude: { type: Number, default: undefined },
    country: { type: String, default: "" },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    tripCount: { type: Number, default: 0 }, // drives trending
    coverImage: { type: String, default: "" },
    images: [{ type: String }],
  },
  { timestamps: true }
);

placeSchema.index({ location: "2dsphere" });
placeSchema.index({ tripCount: -1 });
placeSchema.index({ name: "text", country: "text" });

export const Place = mongoose.model("Place", placeSchema);
