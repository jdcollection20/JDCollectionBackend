import mongoose from "mongoose";

const schema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  image: { type: String, default: "" },
  url: { type: String, default: "/" },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
  status: { type: String, enum: ["draft", "scheduled", "sending", "sent", "partial", "failed"], default: "draft", index: true },
  scheduledFor: Date,
  sentAt: Date,
  recipientCount: { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  failureCount: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model("Notification", schema);
