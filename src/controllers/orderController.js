import mongoose from "mongoose";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Return from "../models/Return.js";

function moneyNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

async function nextOrderNumber() {
  const stamp = new Date();
  const date = `${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, "0")}${String(stamp.getDate()).padStart(2, "0")}`;
  const time = `${String(stamp.getHours()).padStart(2, "0")}${String(stamp.getMinutes()).padStart(2, "0")}${String(stamp.getSeconds()).padStart(2, "0")}`;
  const random = Math.floor(100 + Math.random() * 900);
  return `JD-${date}-${time}-${random}`;
}

export async function create(req, res) {
  const {
    customerName = "",
    customerPhone = "",
    items = [],
    finalTotal,
    paymentMethod = "Cash",
    notes = ""
  } = req.body || {};

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: "Add at least one product to the cart." });
  }

  const normalized = [];
  const seen = new Set();

  for (const raw of items) {
    const productId = String(raw.product || "");
    const quantity = Math.floor(Number(raw.quantity));
    if (!mongoose.isValidObjectId(productId) || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ message: "Each order item must have a valid product and quantity." });
    }

    const key = `${productId}|${String(raw.color || "").trim()}|${String(raw.size || "").trim()}`;
    if (seen.has(key)) return res.status(400).json({ message: "Duplicate product variant in cart." });
    seen.add(key);

    normalized.push({
      productId,
      quantity,
      color: String(raw.color || "").trim(),
      size: String(raw.size || "").trim()
    });
  }

  const ids = normalized.map(x => x.productId);
  const products = await Product.find({ _id: { $in: ids } })
    .select("+purchasePrice +sellingPrice +discountedPrice")
    .lean();
  const productMap = new Map(products.map(p => [String(p._id), p]));

  let subtotal = 0;
  let totalCost = 0;
  const orderItems = [];

  for (const item of normalized) {
    const p = productMap.get(item.productId);
    if (!p) return res.status(404).json({ message: "One of the selected products no longer exists." });
    if (!p.isAvailable) return res.status(409).json({ message: `${p.name} is currently unavailable.` });
    const stock = Math.max(0, Number(p.stockQuantity ?? 0));
    if (item.quantity > stock) {
      return res.status(409).json({ message: `${p.name} has only ${stock} item${stock === 1 ? "" : "s"} in stock.` });
    }
    if (item.color && !(p.colors || []).includes(item.color)) {
      return res.status(400).json({ message: `Invalid color selected for ${p.name}.` });
    }
    if (item.size && !(p.sizes || []).includes(item.size)) {
      return res.status(400).json({ message: `Invalid size selected for ${p.name}.` });
    }

    const sellingPrice = Number(p.sellingPrice || 0);
    const discountedPrice = p.discountedPrice != null ? Number(p.discountedPrice) : sellingPrice;
    const productDiscountPerUnit = Math.max(0, sellingPrice - discountedPrice);
    const lineSubtotal = moneyNumber(sellingPrice * item.quantity);
    const lineProductDiscount = moneyNumber(productDiscountPerUnit * item.quantity);
    const lineDiscountedTotal = moneyNumber(discountedPrice * item.quantity);

    subtotal = moneyNumber(subtotal + lineSubtotal);
    totalCost = moneyNumber(totalCost + Number(p.purchasePrice || 0) * item.quantity);

    orderItems.push({
      product: p._id,
      name: p.name,
      sku: p.sku,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      unitPrice: discountedPrice,
      sellingPrice,
      discountedPrice,
      purchasePrice: Number(p.purchasePrice || 0),
      lineTotal: lineDiscountedTotal,
      productDiscountAmount: lineProductDiscount
    });
  }

  const productDiscountAmount = moneyNumber(orderItems.reduce((sum, item) => sum + Number(item.productDiscountAmount || 0), 0));
  const discountedSubtotal = moneyNumber(subtotal - productDiscountAmount);

  const total = moneyNumber(finalTotal);
  if (!Number.isFinite(total) || total < 0) {
    return res.status(400).json({ message: "Enter a valid final total." });
  }
  if (total > discountedSubtotal) {
    return res.status(400).json({ message: `Final total cannot be greater than the product-discounted total of ₹${discountedSubtotal.toFixed(2)}.` });
  }

  const additionalDiscountAmount = moneyNumber(discountedSubtotal - total);
  const discountAmount = moneyNumber(productDiscountAmount + additionalDiscountAmount);

  // Atomic stock deductions prevent two admins/orders from selling the same
  // stock at the same time. If any item fails, previously deducted items are restored.
  const deducted = [];
  try {
    for (const item of normalized) {
      const updated = await Product.findOneAndUpdate(
        { _id: item.productId, isAvailable: true, stockQuantity: { $gte: item.quantity } },
        { $inc: { stockQuantity: -item.quantity } },
        { new: true }
      );
      if (!updated) {
        const p = productMap.get(item.productId);
        throw Object.assign(new Error(`${p?.name || "A product"} went out of stock. Please refresh and try again.`), { statusCode: 409 });
      }
      deducted.push(item);
    }

    const order = await Order.create({
      orderNumber: await nextOrderNumber(),
      customerName: String(customerName || "").trim(),
      customerPhone: String(customerPhone || "").trim(),
      items: orderItems,
      subtotal,
      productDiscountAmount,
      additionalDiscountAmount,
      discountAmount,
      discountedSubtotal,
      finalTotal: total,
      totalCost,
      profit: moneyNumber(total - totalCost),
      paymentMethod,
      notes: String(notes || "").trim()
    });

    await Product.updateMany(
      { _id: { $in: deducted.map(x => x.productId) }, stockQuantity: { $lte: 0 } },
      { $set: { isAvailable: false } }
    ).catch(() => {});

    res.status(201).json(order);
  } catch (error) {
    await Promise.all(
      deducted.map(item => Product.updateOne({ _id: item.productId }, { $inc: { stockQuantity: item.quantity } }))
    );
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    throw error;
  }
}

export async function list(req, res) {
  const pageNum = Math.max(Number(req.query.page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const [items, total] = await Promise.all([
    Order.find({ status: { $ne: "cancelled" } }).sort("-createdAt").skip((pageNum - 1) * safeLimit).limit(safeLimit).lean(),
    Order.countDocuments({ status: { $ne: "cancelled" } })
  ]);
  const [revenue, returns] = await Promise.all([
    Order.aggregate([
      { $match: { status: "paid" } },
      { $group: {
        _id: null,
        revenue: { $sum: "$finalTotal" },
        discounts: { $sum: "$discountAmount" },
        productDiscounts: { $sum: { $ifNull: ["$productDiscountAmount", 0] } },
        additionalDiscounts: { $sum: { $ifNull: ["$additionalDiscountAmount", 0] } },
        profit: { $sum: "$profit" },
        orders: { $sum: 1 }
      } }
    ]),
    Return.aggregate([{ $group: {
      _id: null,
      amount: { $sum: "$returnAmount" },
      profitImpact: { $sum: "$profitImpact" },
      returns: { $sum: 1 }
    } }])
  ]);
  const gross = revenue[0] || { revenue: 0, discounts: 0, productDiscounts: 0, additionalDiscounts: 0, profit: 0, orders: 0 };
  const returned = returns[0] || { amount: 0, profitImpact: 0, returns: 0 };
  res.json({
    items,
    pagination: { page: pageNum, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) },
    summary: {
      ...gross,
      returns: returned.returns,
      returnedAmount: returned.amount,
      returnedProfitImpact: returned.profitImpact,
      netRevenue: moneyNumber(gross.revenue - returned.amount),
      netProfit: moneyNumber(gross.profit - returned.profitImpact)
    }
  });
}

export async function get(req, res) {
  const order = await Order.findById(req.params.id).lean();
  if (!order) return res.status(404).json({ message: "Order not found." });
  res.json(order);
}
