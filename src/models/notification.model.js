import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "new-post",
        "new-like",
        "new-comment",
        "new-follow",
        "trip-ongoing",
        "trip-completed",
        "trending-place",
        "review-reminder",
      ],
      required: true,
    },
    relatedId: { type: mongoose.Schema.Types.ObjectId, default: null },
    relatedType: { type: String, default: "" },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Notification = mongoose.model("Notification", notificationSchema);
