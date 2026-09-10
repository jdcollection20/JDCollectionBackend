import bcrypt from "bcryptjs";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import Admin from "./models/Admin.js";
import Category from "./models/Category.js";
import ShopSettings from "./models/ShopSettings.js";
import Product from "./models/Product.js";

await connectDB();

const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
await Admin.findOneAndUpdate(
  { username: env.ADMIN_USERNAME.toLowerCase() },
  { username: env.ADMIN_USERNAME.toLowerCase(), passwordHash, role: "admin" },
  { upsert: true, new: true }
);

const categoryNames = ["Remote Control Toys", "Cars", "Dolls", "Educational Toys", "Baby Toys", "Outdoor Toys", "Board Games", "Puzzles", "Soft Toys", "Action Figures", "Building Toys", "School Items", "Gift Items"];
for (let i = 0; i < categoryNames.length; i++) {
  const name = categoryNames[i];
  await Category.findOneAndUpdate(
    { slug: name.toLowerCase().replace(/\s+/g, "-") },
    { name, slug: name.toLowerCase().replace(/\s+/g, "-"), sortOrder: i, isActive: true },
    { upsert: true }
  );
}

await ShopSettings.findOneAndUpdate(
  { singleton: "main" },
  { singleton: "main", shopName: "JD COLLECTION", description: "A friendly neighborhood toy shop." },
  { upsert: true }
);

const rc = await Category.findOne({ slug: "remote-control-toys" });
if (rc && !(await Product.exists({ sku: "DEMO-RC-001" }))) {
  await Product.create({
    name: "Demo Remote Control Racing Car",
    slug: "demo-remote-control-racing-car",
    sku: "DEMO-RC-001",
    category: rc._id,
    description: "Demo seed product — replace with your real catalog.",
    specifications: { "Recommended age": "6+", "Battery": "Included" },
    purchasePrice: 400,
    sellingPrice: 700,
    discountedPrice: 599,
    isPriceVisible: true,
    isAvailable: true,
    isTodaysOffer: true,
    isMostDemanded: true
  });
}
console.log("Seed completed.");
process.exit(0);
