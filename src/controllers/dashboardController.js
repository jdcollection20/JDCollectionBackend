import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Notification from "../models/Notification.js";
import Order from "../models/Order.js";
import Return from "../models/Return.js";

export async function dashboard(req, res) {
  const [
    totalProducts, availableProducts, outOfStock, todaysOffers,
    mostDemanded, totalCategories, notificationsSent
  ] = await Promise.all([
    Product.countDocuments(),
    Product.countDocuments({ isAvailable: true }),
    Product.countDocuments({ isAvailable: false }),
    Product.countDocuments({ isTodaysOffer: true }),
    Product.countDocuments({ isMostDemanded: true }),
    Category.countDocuments(),
    Notification.countDocuments({ status: { $in: ["sent", "partial"] } })
  ]);

  const [orderFinancial, returnFinancial] = await Promise.all([
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
      }}
    ]),
    Return.aggregate([{ $group: {
      _id: null,
      amount: { $sum: "$returnAmount" },
      cost: { $sum: "$totalCost" },
      profitImpact: { $sum: "$profitImpact" },
      returns: { $sum: 1 }
    }}])
  ]);

  const gross = orderFinancial[0] || { revenue: 0, discounts: 0, productDiscounts: 0, additionalDiscounts: 0, profit: 0, orders: 0 };
  const returned = returnFinancial[0] || { amount: 0, cost: 0, profitImpact: 0, returns: 0 };
  const netRevenue = Math.round((gross.revenue - returned.amount) * 100) / 100;
  const netProfit = Math.round((gross.profit - returned.profitImpact) * 100) / 100;

  const financial = await Product.aggregate([
    { $project: {
      purchase: { $ifNull: ["$purchasePrice", 0] },
      selling: { $ifNull: ["$sellingPrice", 0] },
      discounted: { $ifNull: ["$discountedPrice", "$sellingPrice"] },
      quantity: { $ifNull: ["$stockQuantity", 1] },
      available: "$isAvailable"
    }},
    { $group: {
      _id: null,
      inventoryPurchaseValue: { $sum: { $cond: ["$available", { $multiply: ["$purchase", "$quantity"] }, 0] } },
      potentialSalesValue: { $sum: { $cond: ["$available", { $multiply: ["$selling", "$quantity"] }, 0] } },
      normalProfit: { $sum: { $cond: ["$available", { $multiply: [{ $subtract: ["$selling", "$purchase"] }, "$quantity"] }, 0] } },
      discountedProfit: { $sum: { $cond: ["$available", { $multiply: [{ $subtract: ["$discounted", "$purchase"] }, "$quantity"] }, 0] } }
    }}
  ]);

  res.json({
    counts: { totalProducts, availableProducts, outOfStock, todaysOffers, mostDemanded, totalCategories, notificationsSent },
    financial: financial[0] || {},
    revenue: {
    ...gross,
    returnedAmount: returned.amount,
    returnedCost: returned.cost,
    returnedProfitImpact: returned.profitImpact,
    returns: returned.returns,
    netRevenue,
    netProfit
  }
  });
}
