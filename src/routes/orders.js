import { Router } from "express";
import { create, list, get } from "../controllers/orderController.js";
import { requireAuth } from "../middleware/auth.js";

const r = Router();
r.get("/", requireAuth, list);
r.get("/:id", requireAuth, get);
r.post("/", requireAuth, create);

export default r;
