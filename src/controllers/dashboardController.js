import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Notification from "../models/Notification.js";

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

  const financial = await Product.aggregate([
    { $project: {
      purchase: { $ifNull: ["$purchasePrice", 0] },
      selling: { $ifNull: ["$sellingPrice", 0] },
      discounted: { $ifNull: ["$discountedPrice", 0] },
      available: "$isAvailable"
    }},
    { $group: {
      _id: null,
      inventoryPurchaseValue: { $sum: { $cond: ["$available", "$purchase", 0] } },
      potentialSalesValue: { $sum: { $cond: ["$available", "$selling", 0] } },
      normalProfit: { $sum: { $cond: ["$available", { $subtract: ["$selling", "$purchase"] }, 0] } },
      discountedProfit: { $sum: { $cond: ["$available", { $subtract: ["$discounted", "$purchase"] }, 0] } }
    }}
  ]);

  res.json({ counts: { totalProducts, availableProducts, outOfStock, todaysOffers, mostDemanded, totalCategories, notificationsSent }, financial: financial[0] || {} });
}
