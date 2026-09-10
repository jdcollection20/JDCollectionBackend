import mongoose from "mongoose";

const schema = new mongoose.Schema({
  singleton: { type: String, default: "main", unique: true },
  shopName: { type: String, default: "JD COLLECTION" },
  logo: { publicId: String, secureUrl: String },
  description: { type: String, default: "" },
  address: { type: String, default: "" },
  phone: { type: String, default: "" },
  whatsapp: { type: String, default: "" },
  googleMapsUrl: { type: String, default: "" },
  openingHours: { type: String, default: "" },
  socialLinks: { type: Map, of: String, default: {} },
  heroContent: {
    title: { type: String, default: "Big fun starts here!" },
    description: { type: String, default: "Discover toys, watches, perfumes and gifts with fresh offers every day." },
    image: { publicId: String, secureUrl: String }
  }
}, { timestamps: true });

export default mongoose.model("ShopSettings", schema);
