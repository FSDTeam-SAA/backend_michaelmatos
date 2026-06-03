import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    caption: { type: String, default: "", maxlength: 2000 },
    images: [{ type: String }],
    location: {
      name: { type: String, default: "" },
      coordinates: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], default: [0, 0] }, // [longitude, latitude]
      },
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
