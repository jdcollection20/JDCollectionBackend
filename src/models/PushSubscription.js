import mongoose from "mongoose";

const schema = new mongoose.Schema({
  endpoint: { type: String, required: true, unique: true, index: true },
  expirationTime: Date,
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true }
  }
}, { timestamps: true });

export default mongoose.model("PushSubscription", schema);
