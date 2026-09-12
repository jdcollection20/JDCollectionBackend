import Product from "../models/Product.js";
import Category from "../models/Category.js";
import { productInput } from "../utils/validation.js";
import { adminProduct, publicProduct } from "../utils/publicProduct.js";
import { slugify } from "../utils/slug.js";
import { uploadBuffer, destroyAsset } from "../services/cloudinaryService.js";

async function uniqueSlug(name, id) {
  const base = slugify(name);
  let slug = base,
    n = 1;
  while (await Product.exists({ slug, ...(id ? { _id: { $ne: id } } : {}) }))
    slug = `${base}-${n++}`;
  return slug;
}

async function uniqueSku(name) {
  const base =
    String(name || "")
      .toUpperCase()
      .trim()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "PRODUCT";

  let sku = `${base}-001`;
  let n = 1;

  while (await Product.exists({ sku })) {
    n++;
    sku = `${base}-${String(n).padStart(3, "0")}`;
  }

  return sku;
}

export async function listPublic(req, res) {
  const {
    q,
    category,
    available,
    offer,
    demanded,
    page = 1,
    limit = 12,
    sort = "-createdAt",
  } = req.query;
  const filter = {};
  if (q) filter.$text = { $search: q };
  if (category) filter.category = category;
  if (available === "true") filter.isAvailable = true;
  if (available === "false") filter.isAvailable = false;
  if (offer === "true") filter.isTodaysOffer = true;
  if (demanded === "true") filter.isMostDemanded = true;

  const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * safeLimit;
  const [items, total] = await Promise.all([
    Product.find(filter)
      .select("+sellingPrice +discountedPrice")
      .populate("category", "name slug")
      .sort(sort)
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Product.countDocuments(filter),
  ]);
  res.json({
    items: items.map(publicProduct),
    pagination: {
      page: Number(page),
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
    },
  });
}

export async function getPublic(req, res) {
  const p = await Product.findOne({ slug: req.params.slug })
    .select("+sellingPrice +discountedPrice")
    .populate("category", "name slug")
    .lean();
  if (!p) return res.status(404).json({ message: "Product not found" });
  res.json(publicProduct(p));
}

export async function listAdmin(req, res) {
  const {
    q,
    category,
    available,
    offer,
    demanded,
    page = 1,
    limit = 20,
    sort = "-createdAt",
  } = req.query;
  const filter = {};

  if (q?.trim()) {
    const search = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    filter.$or = [
      { name: new RegExp(search, "i") },
      { sku: new RegExp(search, "i") },
      { productCode: new RegExp(search, "i") },
    ];
  }
  if (category) filter.category = category;
  if (available === "true") filter.isAvailable = true;
  if (available === "false") filter.isAvailable = false;
  if (offer === "true") filter.isTodaysOffer = true;
  if (demanded === "true") filter.isMostDemanded = true;

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const pageNum = Math.max(Number(page) || 1, 1);
  const [items, total] = await Promise.all([
    Product.find(filter)
      .select("+purchasePrice +sellingPrice +discountedPrice")
      .populate("category", "name slug")
      .sort(sort)
      .skip((pageNum - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    Product.countDocuments(filter),
  ]);
  res.json({
    items: items.map(adminProduct),
    pagination: {
      page: pageNum,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
    },
  });
}

export async function getAdmin(req, res) {
  const p = await Product.findById(req.params.id)
    .select("+purchasePrice +sellingPrice +discountedPrice")
    .populate("category", "name slug");
  if (!p) return res.status(404).json({ message: "Product not found" });
  res.json(adminProduct(p));
}

async function uploadMediaFiles(files) {
  const uploaded = [];
  for (let index = 0; index < (files || []).length; index++) {
    const file = files[index];
    const isVideo = file.mimetype.startsWith("video/");
    const result = await uploadBuffer(file.buffer, {
      folder: `toy-shop/${isVideo ? "videos" : "images"}`,
      resourceType: isVideo ? "video" : "image",
    });
    uploaded.push({
      token: `new:${index}`,
      type: isVideo ? "video" : "image",
      media: {
        publicId: result.public_id,
        secureUrl: result.secure_url,
        resourceType: isVideo ? "video" : "image",
        format: result.format,
        width: result.width,
        height: result.height,
        duration: result.duration,
      },
    });
  }
  return uploaded;
}

function orderMedia(existing, uploaded, order, type) {
  const existingMap = new Map(existing.map((m) => [m.publicId, m]));
  const uploadedMap = new Map(
    uploaded.filter((x) => x.type === type).map((x) => [x.token, x.media]),
  );

  // When the client sends an order array, it is authoritative.
  // This is important for deletion: an existing media item omitted from the
  // array was intentionally removed in the editor and must not be re-added.
  if (Array.isArray(order)) {
    const result = [];
    const used = new Set();
    for (const key of order.filter(Boolean)) {
      let media = null;
      if (key.startsWith("existing:")) {
        media = existingMap.get(key.slice(9));
      } else if (key.startsWith("new:")) {
        media = uploadedMap.get(key);
      }
      if (media && !used.has(media.publicId)) {
        result.push(media);
        used.add(media.publicId);
      }
    }
    return result;
  }

  // Backward-compatible fallback for older clients that did not send an order.
  return [
    ...existing,
    ...uploaded.filter((x) => x.type === type).map((x) => x.media),
  ];
}

export async function create(req, res) {
  const body = JSON.parse(req.body.data || "{}");
  const { mediaOrder, ...productBody } = body;
  const input = productInput.parse(productBody);
  if (!(await Category.exists({ _id: input.category })))
    return res.status(400).json({ message: "Invalid category" });
  const product = new Product({
    ...input,
    sku: await uniqueSku(input.name),
    slug: await uniqueSlug(input.name),
  });
  const uploaded = await uploadMediaFiles(req.files || []);
  product.images = orderMedia([], uploaded, mediaOrder?.images, "image");
  product.videos = orderMedia([], uploaded, mediaOrder?.videos, "video");
  await product.save();
  res
    .status(201)
    .json(
      adminProduct(
        await Product.findById(product._id)
          .select("+purchasePrice +sellingPrice +discountedPrice")
          .populate("category", "name slug"),
      ),
    );
}

export async function update(req, res) {
  const existing = await Product.findById(req.params.id).select(
    "+purchasePrice +sellingPrice +discountedPrice",
  );
  if (!existing) return res.status(404).json({ message: "Product not found" });
  const body = JSON.parse(req.body.data || "{}");
  const { mediaOrder, ...productBody } = body;
  const input = productInput.parse(productBody);
  if (!(await Category.exists({ _id: input.category })))
    return res.status(400).json({ message: "Invalid category" });

  const oldImages = [...existing.images];
  const oldVideos = [...existing.videos];
  Object.assign(existing, input);
  existing.slug = await uniqueSlug(input.name, existing._id);

  const uploaded = await uploadMediaFiles(req.files || []);
  const nextImages = orderMedia(
    oldImages,
    uploaded,
    mediaOrder?.images,
    "image",
  );
  const nextVideos = orderMedia(
    oldVideos,
    uploaded,
    mediaOrder?.videos,
    "video",
  );

  const keepImageIds = new Set(nextImages.map((m) => m.publicId));
  const keepVideoIds = new Set(nextVideos.map((m) => m.publicId));
  await Promise.all([
    ...oldImages
      .filter((m) => !keepImageIds.has(m.publicId))
      .map((m) => destroyAsset(m.publicId, "image")),
    ...oldVideos
      .filter((m) => !keepVideoIds.has(m.publicId))
      .map((m) => destroyAsset(m.publicId, "video")),
  ]);

  existing.images = nextImages;
  existing.videos = nextVideos;
  await existing.save();
  res.json(
    adminProduct(
      await Product.findById(existing._id)
        .select("+purchasePrice +sellingPrice +discountedPrice")
        .populate("category", "name slug"),
    ),
  );
}

export async function remove(req, res) {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Product not found" });
  await Promise.all([
    ...p.images.map((m) => destroyAsset(m.publicId, "image")),
    ...p.videos.map((m) => destroyAsset(m.publicId, "video")),
  ]);
  await p.deleteOne();
  res.json({ message: "Product deleted successfully" });
}

export async function deleteMedia(req, res) {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: "Product not found" });
  const { type, publicId } = req.body;
  const field = type === "video" ? "videos" : "images";
  const media = p[field].find((m) => m.publicId === publicId);
  if (!media) return res.status(404).json({ message: "Media not found" });
  await destroyAsset(publicId, type === "video" ? "video" : "image");
  p[field] = p[field].filter((m) => m.publicId !== publicId);
  await p.save();
  res.json({ message: "Media deleted" });
}
