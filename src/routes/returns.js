import { Router } from "express";
import { create, list } from "../controllers/returnController.js";
import { requireAuth } from "../middleware/auth.js";

const r = Router();
r.get("/", requireAuth, list);
r.post("/", requireAuth, create);

export default r;
