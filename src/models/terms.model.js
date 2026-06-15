import mongoose from "mongoose";

// Single editable legal document per type (terms, privacy, about, etc.)
const termsSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["terms", "privacy", "about"], default: "terms", unique: true },
    content: { type: String, default: "" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export const Terms = mongoose.model("Terms", termsSchema);
