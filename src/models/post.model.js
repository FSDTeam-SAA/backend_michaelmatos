import mongoose from "mongoose";

const geoPointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);

const postSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    caption: { type: String, default: "", maxlength: 2000 },
    images: [{ type: String }],
    location: {
      name: { type: String, default: "" },
      latitude: { type: Number, default: undefined },
      longitude: { type: Number, default: undefined },
      coordinates: { type: geoPointSchema, default: undefined },
    },
    placeType: {
      type: String,
      enum: ["city", "beach", "mountains", "nature", "culture", "food"],
      default: "city",
    },
    isPrivate: { type: Boolean, default: false },
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    bookmarksCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

postSchema.index({ "location.coordinates": "2dsphere" });
postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ isPrivate: 1 });

export const Post = mongoose.model("Post", postSchema);
