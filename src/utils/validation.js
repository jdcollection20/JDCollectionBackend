import { z } from "zod";

export const productInput = z.object({
  name: z.string().min(2).max(160),
  sku: z.string().min(1).max(80),
  category: z.string().min(1),
  description: z.string().max(10000).optional().default(""),
  stockQuantity: z.number().int().nonnegative().default(1),
  colors: z.array(z.string().trim().min(1).max(50)).default([]),
  sizes: z.array(z.string().trim().min(1).max(50)).default([]),
  specifications: z.record(z.string(), z.string()).optional().default({}),
  purchasePrice: z.number().nonnegative(),
  sellingPrice: z.number().nonnegative(),
  discountedPrice: z.number().nonnegative().nullable().optional(),
  isPriceVisible: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
  isTodaysOffer: z.boolean().default(false),
  isMostDemanded: z.boolean().default(false)
}).superRefine((v, ctx) => {
  if (v.discountedPrice != null && v.discountedPrice >= v.sellingPrice) {
    ctx.addIssue({ code: "custom", path: ["discountedPrice"], message: "Discounted price must be lower than selling price." });
  }
});
