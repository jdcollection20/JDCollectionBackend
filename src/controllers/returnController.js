import mongoose from "mongoose";
import Product from "../models/Product.js";
import Return from "../models/Return.js";

function moneyNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

async function nextReturnNumber() {
  const stamp = new Date();
  const date = `${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, "0")}${String(stamp.getDate()).padStart(2, "0")}`;
  const time = `${String(stamp.getHours()).padStart(2, "0")}${String(stamp.getMinutes()).padStart(2, "0")}${String(stamp.getSeconds()).padStart(2, "0")}`;
  const random = Math.floor(100 + Math.random() * 900);
  return `JDR-${date}-${time}-${random}`;
}

export async function create(req, res) {
  const { items = [], returnAmount, customerName = "", customerPhone = "", reason = "", notes = "" } = req.body || {};

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: "Add at least one return item." });
  }

  const normalized = [];
  const seen = new Set();
  for (const raw of items) {
    const productId = String(raw.product || "");
    const quantity = Math.floor(Number(raw.quantity));
    if (!mongoose.isValidObjectId(productId) || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ message: "Each return item must have a valid product and quantity." });
    }
    const color = String(raw.color || "").trim();
    const size = String(raw.size || "").trim();
    const key = `${productId}|${color}|${size}`;
    if (seen.has(key)) return res.status(400).json({ message: "Duplicate product variant in return cart." });
    seen.add(key);
    normalized.push({ productId, quantity, color, size });
  }

  const products = await Product.find({ _id: { $in: normalized.map(x => x.productId) } })
    .select("+purchasePrice +sellingPrice +discountedPrice")
    .lean();
  const productMap = new Map(products.map(p => [String(p._id), p]));

  let calculatedAmount = 0;
  let totalCost = 0;
  const returnItems = [];

  for (const item of normalized) {
    const p = productMap.get(item.productId);
    if (!p) return res.status(404).json({ message: "One of the selected products no longer exists." });
    if (item.color && !(p.colors || []).includes(item.color)) return res.status(400).json({ message: `Invalid color selected for ${p.name}.` });
    if (item.size && !(p.sizes || []).includes(item.size)) return res.status(400).json({ message: `Invalid size selected for ${p.name}.` });

    const sellingPrice = Number(p.sellingPrice || 0);
    const discountedPrice = p.discountedPrice != null ? Number(p.discountedPrice) : sellingPrice;
    const purchasePrice = Number(p.purchasePrice || 0);
    const lineReturnAmount = moneyNumber(discountedPrice * item.quantity);
    const lineCost = moneyNumber(purchasePrice * item.quantity);
    calculatedAmount = moneyNumber(calculatedAmount + lineReturnAmount);
    totalCost = moneyNumber(totalCost + lineCost);

    returnItems.push({
      product: p._id,
      name: p.name,
      sku: p.sku,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      sellingPrice,
      discountedPrice,
      purchasePrice,
      lineReturnAmount,
      lineCost
    });
  }

  const total = returnAmount === "" || returnAmount == null ? calculatedAmount : moneyNumber(returnAmount);
  if (!Number.isFinite(total) || total < 0) return res.status(400).json({ message: "Enter a valid return amount." });
  if (total > calculatedAmount) {
    return res.status(400).json({ message: `Return amount cannot be greater than the calculated return value of ₹${calculatedAmount.toFixed(2)}.` });
  }

  const deducted = [];
  try {
    // Returning stock is an inventory increase. Keep it atomic per product.
    for (const item of normalized) {
      const updated = await Product.findOneAndUpdate(
        { _id: item.productId },
        { $inc: { stockQuantity: item.quantity }, $set: { isAvailable: true } },
        { new: true }
      );
      if (!updated) throw Object.assign(new Error("Could not restore one of the returned products."), { statusCode: 409 });
      deducted.push(item);
    }

    const profitImpact = moneyNumber(total - totalCost);
    const record = await Return.create({
      returnNumber: await nextReturnNumber(),
      items: returnItems,
      calculatedAmount,
      returnAmount: total,
      totalCost,
      profitImpact,
      customerName: String(customerName || "").trim(),
      customerPhone: String(customerPhone || "").trim(),
      reason: String(reason || "").trim(),
      notes: String(notes || "").trim()
    });

    res.status(201).json(record);
  } catch (error) {
    await Promise.all(deducted.map(item => Product.updateOne({ _id: item.productId }, { $inc: { stockQuantity: -item.quantity } })));
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    throw error;
  }
}

export async function list(req, res) {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const [items, total, summary] = await Promise.all([
    Return.find().sort("-createdAt").skip((page - 1) * limit).limit(limit).lean(),
    Return.countDocuments(),
    Return.aggregate([{ $group: {
      _id: null,
      amount: { $sum: "$returnAmount" },
      cost: { $sum: "$totalCost" },
      profitImpact: { $sum: "$profitImpact" },
      returns: { $sum: 1 }
    } }])
  ]);
  res.json({
    items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    summary: summary[0] || { amount: 0, cost: 0, profitImpact: 0, returns: 0 }
  });
}
