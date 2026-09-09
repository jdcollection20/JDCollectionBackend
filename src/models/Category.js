import mongoose from "mongoose";

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, index: true },
  description: { type: String, default: "" },
  image: {
    publicId: String,
    secureUrl: String
  },
  isActive: { type: Boolean, default: true, index: true },
  sortOrder: { type: Number, default: 0, index: true }
}, { timestamps: true });

export default mongoose.model("Category", schema);
