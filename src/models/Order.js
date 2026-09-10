import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  name: { type: String, required: true },
  sku: { type: String, required: true },
  color: { type: String, default: "" },
  size: { type: String, default: "" },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  sellingPrice: { type: Number, min: 0, default: 0 },
  discountedPrice: { type: Number, min: 0, default: 0 },
  purchasePrice: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
  productDiscountAmount: { type: Number, min: 0, default: 0 }
}, { _id: false });

const schema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, index: true },
  customerName: { type: String, default: "", trim: true },
  customerPhone: { type: String, default: "", trim: true },
  items: { type: [itemSchema], required: true, validate: v => Array.isArray(v) && v.length > 0 },
  subtotal: { type: Number, required: true, min: 0 },
  // Discount already included in product prices: sellingPrice -> discountedPrice.
  productDiscountAmount: { type: Number, min: 0, default: 0 },
  // Extra discount applied when the admin manually lowers Final Total.
  additionalDiscountAmount: { type: Number, min: 0, default: 0 },
  // Complete discount = product discount + additional discount.
  discountAmount: { type: Number, required: true, min: 0, default: 0 },
  discountedSubtotal: { type: Number, min: 0, default: 0 },
  finalTotal: { type: Number, required: true, min: 0 },
  totalCost: { type: Number, required: true, min: 0, default: 0 },
  profit: { type: Number, required: true, default: 0 },
  paymentMethod: { type: String, enum: ["Cash", "UPI", "Card", "Bank Transfer", "Other"], default: "Cash" },
  status: { type: String, enum: ["paid", "cancelled"], default: "paid", index: true },
  notes: { type: String, default: "" }
}, { timestamps: true });

schema.index({ createdAt: -1 });

export default mongoose.model("Order", schema);
