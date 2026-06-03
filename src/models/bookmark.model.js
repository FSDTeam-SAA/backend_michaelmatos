import mongoose from "mongoose";

const bookmarkSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
  },
  { timestamps: true }
);

bookmarkSchema.index({ userId: 1, postId: 1 }, { unique: true });

export const Bookmark = mongoose.model("Bookmark", bookmarkSchema);
