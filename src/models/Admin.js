import mongoose from "mongoose";

const schema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["admin"], default: "admin" }
}, { timestamps: true });

export default mongoose.model("Admin", schema);
