import { Router } from "express";
import { list, create, send } from "../controllers/notificationController.js";
import { requireAuth } from "../middleware/auth.js";
const r = Router();
r.get("/", requireAuth, list);
r.post("/", requireAuth, create);
r.post("/:id/send", requireAuth, send);
export default r;
