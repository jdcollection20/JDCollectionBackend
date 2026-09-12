import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true },
    secureUrl: { type: String, required: true },
    resourceType: { type: String, enum: ["image", "video"], required: true },
    format: String,
    width: Number,
    height: Number,
    duration: Number,
  },
  { _id: false },
);

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    sku: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
    },
    productCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      index: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    description: { type: String, default: "" },
    stockQuantity: { type: Number, default: 1, min: 0 },
    colors: { type: [String], default: [] },
    sizes: { type: [String], default: [] },
    specifications: { type: Map, of: String, default: {} },
    purchasePrice: { type: Number, required: true, min: 0, select: false },
    sellingPrice: { type: Number, required: true, min: 0, select: false },
    discountedPrice: { type: Number, min: 0, select: false },
    isPriceVisible: { type: Boolean, default: true, index: true },
    isAvailable: { type: Boolean, default: true, index: true },
    isTodaysOffer: { type: Boolean, default: false, index: true },
    isMostDemanded: { type: Boolean, default: false, index: true },
    images: { type: [mediaSchema], default: [] },
    videos: { type: [mediaSchema], default: [] },
  },
  { timestamps: true },
);

schema.index({ name: "text", sku: "text" });
schema.index({ category: 1, isAvailable: 1 });
schema.index({ isTodaysOffer: 1, isAvailable: 1 });
schema.index({ isMostDemanded: 1, isAvailable: 1 });

export default mongoose.model("Product", schema);
