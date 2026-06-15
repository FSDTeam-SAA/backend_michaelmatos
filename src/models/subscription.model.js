import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Basic", "Premium"
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 }, // e.g. 4.99
    currency: { type: String, default: "£" },
    interval: { type: String, default: "Month" }, // "Month" | "Year" | "Unlimited"
    searchLimit: { type: Number, default: 0 }, // number of AI searches included
    features: [{ type: String }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
