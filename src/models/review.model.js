import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true },
    placeId: { type: mongoose.Schema.Types.ObjectId, ref: "Place", required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, default: "", maxlength: 2000 },
    images: [{ type: String }],
  },
  { timestamps: true }
);

reviewSchema.index({ userId: 1, tripId: 1 }, { unique: true });

export const Review = mongoose.model("Review", reviewSchema);
