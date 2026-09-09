import { Router } from "express";
import { listPublic, getPublic, listAdmin, getAdmin, create, update, remove, deleteMedia } from "../controllers/productController.js";
import { requireAuth } from "../middleware/auth.js";
import { mediaUpload } from "../middleware/upload.js";

const r = Router();

r.get("/admin/list", requireAuth, listAdmin);
r.get("/admin/:id", requireAuth, getAdmin);

r.get("/", listPublic);
r.get("/:slug", getPublic);

r.post("/", requireAuth, mediaUpload.array("media", 12), create);
r.put("/:id", requireAuth, mediaUpload.array("media", 12), update);
r.delete("/:id", requireAuth, remove);
r.delete("/:id/media", requireAuth, deleteMedia);

export default r;
