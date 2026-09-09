import { Router } from "express";
import { dashboard } from "../controllers/dashboardController.js";
import { requireAuth } from "../middleware/auth.js";
const r = Router();
r.get("/dashboard", requireAuth, dashboard);
export default r;
