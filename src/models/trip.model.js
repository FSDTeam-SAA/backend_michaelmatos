import mongoose from "mongoose";

const geoPointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);

const tripSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    coverImage: { type: String, default: "" },
    tripName: { type: String, required: true, trim: true },
    location: {
      name: { type: String, default: "" },
      latitude: { type: Number, default: undefined },
      longitude: { type: Number, default: undefined },
      coordinates: { type: geoPointSchema, default: undefined },
    },
    placeId: { type: mongoose.Schema.Types.ObjectId, ref: "Place" },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    tripType: {
      type: String,
      enum: ["city", "beach", "mountains", "nature", "culture", "food"],
      default: "city",
    },
    status: {
      type: String,
      enum: ["upcoming", "ongoing", "completed"],
      default: "upcoming",
    },
    placesCount: { type: Number, default: 0 },
    upcomingCount: { type: Number, default: 0 },
    completedCount: { type: Number, default: 0 },
    reviewSubmitted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

tripSchema.index({ "location.coordinates": "2dsphere" });
tripSchema.index({ userId: 1, status: 1 });
tripSchema.index({ fromDate: 1, toDate: 1, status: 1 });

export const Trip = mongoose.model("Trip", tripSchema);
