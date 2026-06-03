import mongoose from "mongoose";

const helpTicketSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    status: { type: String, enum: ["open", "in-progress", "resolved"], default: "open" },
  },
  { timestamps: true }
);

export const HelpTicket = mongoose.model("HelpTicket", helpTicketSchema);
