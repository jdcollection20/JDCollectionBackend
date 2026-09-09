export function publicProduct(doc) {
  const p = doc.toObject ? doc.toObject() : doc;
  const base = {
    _id: p._id,
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    category: p.category,
    description: p.description,
    specifications: p.specifications,
    isPriceVisible: p.isPriceVisible,
    isAvailable: p.isAvailable,
    isTodaysOffer: p.isTodaysOffer,
    isMostDemanded: p.isMostDemanded,
    images: p.images,
    videos: p.videos,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt
  };
  if (p.isPriceVisible) {
    base.sellingPrice = p.sellingPrice;
    base.discountedPrice = p.discountedPrice;
  }
  return base;
}

export function adminProduct(doc) {
  const p = doc.toObject ? doc.toObject() : doc;
  const normalProfit = p.sellingPrice - p.purchasePrice;
  const discountedProfit = p.discountedPrice != null ? p.discountedPrice - p.purchasePrice : null;
  return {
    ...p,
    normalProfit,
    discountedProfit,
    normalMargin: p.sellingPrice ? (normalProfit / p.sellingPrice) * 100 : 0,
    discountedMargin: p.discountedPrice ? (discountedProfit / p.discountedPrice) * 100 : null
  };
}
