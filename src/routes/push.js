import { Router } from "express";
import { publicKey, subscribe, unsubscribe } from "../controllers/pushController.js";
const r = Router();
r.get("/public-key", publicKey);
r.post("/subscribe", subscribe);
r.delete("/unsubscribe", unsubscribe);
export default r;
