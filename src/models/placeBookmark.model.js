import mongoose from "mongoose";

const placeBookmarkSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    placeId: { type: mongoose.Schema.Types.ObjectId, ref: "Place", required: true },
  },
  { timestamps: true }
);

placeBookmarkSchema.index({ userId: 1, placeId: 1 }, { unique: true });

export const PlaceBookmark = mongoose.model("PlaceBookmark", placeBookmarkSchema);
