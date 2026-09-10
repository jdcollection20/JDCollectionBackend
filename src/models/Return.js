import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  name: { type: String, required: true },
  sku: { type: String, required: true },
  color: { type: String, default: "" },
  size: { type: String, default: "" },
  quantity: { type: Number, required: true, min: 1 },
  sellingPrice: { type: Number, required: true, min: 0 },
  discountedPrice: { type: Number, required: true, min: 0 },
  purchasePrice: { type: Number, required: true, min: 0 },
  lineReturnAmount: { type: Number, required: true, min: 0 },
  lineCost: { type: Number, required: true, min: 0 }
}, { _id: false });

const schema = new mongoose.Schema({
  returnNumber: { type: String, required: true, unique: true, index: true },
  items: { type: [itemSchema], required: true, validate: v => Array.isArray(v) && v.length > 0 },
  calculatedAmount: { type: Number, required: true, min: 0 },
  returnAmount: { type: Number, required: true, min: 0 },
  totalCost: { type: Number, required: true, min: 0 },
  profitImpact: { type: Number, required: true, default: 0 },
  customerName: { type: String, default: "", trim: true },
  customerPhone: { type: String, default: "", trim: true },
  reason: { type: String, default: "", trim: true },
  notes: { type: String, default: "", trim: true }
}, { timestamps: true });

schema.index({ createdAt: -1 });

export default mongoose.model("Return", schema);
