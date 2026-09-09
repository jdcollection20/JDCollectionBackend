import ShopSettings from "../models/ShopSettings.js";
import { uploadBuffer, destroyAsset } from "../services/cloudinaryService.js";

const allowedFields = [
  "shopName",
  "logo",
  "description",
  "address",
  "phone",
  "whatsapp",
  "googleMapsUrl",
  "openingHours",
  "socialLinks",
  "heroContent"
];

export async function get(req, res) {
  let settings = await ShopSettings.findOne({ singleton: "main" }).lean();
  if (!settings) settings = await ShopSettings.create({ singleton: "main" });
  res.json(settings);
}

export async function update(req, res) {
  const update = {};
  for (const key of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      let value = req.body[key];
      if ((key === "heroContent" || key === "socialLinks") && typeof value === "string") {
        try { value = JSON.parse(value); } catch { return res.status(400).json({ message: `Invalid ${key} data.` }); }
      }
      update[key] = value;
    }
  }

  const current = await ShopSettings.findOne({ singleton: "main" });

  if (update.heroContent) {
    update.heroContent = {
      ...(current?.heroContent?.toObject?.() || current?.heroContent || {}),
      ...update.heroContent
    };
  }

  if (req.file) {
    if (!req.file.mimetype?.startsWith("image/")) return res.status(400).json({ message: "Hero image must be a JPG, PNG, or WebP image." });
    const result = await uploadBuffer(req.file.buffer, { folder: "toy-shop/hero", resourceType: "image" });
    const oldPublicId = current?.heroContent?.image?.publicId;
    update.heroContent = {
      ...(current?.heroContent?.toObject?.() || current?.heroContent || {}),
      ...(update.heroContent || {}),
      image: { publicId: result.public_id, secureUrl: result.secure_url }
    };
    if (oldPublicId) await destroyAsset(oldPublicId, "image");
  } else if (req.body.removeHeroImage === "true" || req.body.removeHeroImage === true) {
    const oldPublicId = current?.heroContent?.image?.publicId;
    update.heroContent = {
      ...(current?.heroContent?.toObject?.() || current?.heroContent || {}),
      ...(update.heroContent || {})
    };
    delete update.heroContent.image;
    if (oldPublicId) await destroyAsset(oldPublicId, "image");
  }

  delete update.removeHeroImage;

  const settings = await ShopSettings.findOneAndUpdate(
    { singleton: "main" },
    { $set: update, $setOnInsert: { singleton: "main" } },
    { new: true, upsert: true, runValidators: true }
  ).lean();

  res.json(settings);
}
