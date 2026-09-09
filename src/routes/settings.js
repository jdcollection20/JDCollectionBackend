import { Router } from "express";
import { get, update } from "../controllers/settingsController.js";
import { requireAuth } from "../middleware/auth.js";
import { mediaUpload } from "../middleware/upload.js";
const r = Router();
r.get("/", get);
r.put("/", requireAuth, mediaUpload.single("heroImage"), update);
export default r;
