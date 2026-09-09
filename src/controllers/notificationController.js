import Notification from "../models/Notification.js";
import { sendToAll } from "../services/notificationService.js";

export async function list(req, res) {
  const pageNum = Math.max(Number(req.query.page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const [items, total] = await Promise.all([
    Notification.find({}).populate("product", "name slug").sort("-createdAt").skip((pageNum - 1) * safeLimit).limit(safeLimit).lean(),
    Notification.countDocuments({})
  ]);
  res.json({ items, pagination: { page: pageNum, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) } });
}

export async function create(req, res) {
  const { title, message, image = "", product = null, url = "/", scheduledFor = null } = req.body;
  const status = scheduledFor ? "scheduled" : "draft";
  const n = await Notification.create({ title, message, image, product, url, scheduledFor, status });
  res.status(201).json(n);
}

export async function send(req, res) {
  const n = await Notification.findById(req.params.id);
  if (!n) return res.status(404).json({ message: "Notification not found" });
  if (n.status === "sent") return res.status(409).json({ message: "Notification already sent" });
  n.status = "sending"; await n.save();

  try {
    const result = await sendToAll({ title: n.title, body: n.message, image: n.image || undefined, data: { url: n.url || "/" } });
    Object.assign(n, result, { status: result.failureCount ? "partial" : "sent", sentAt: new Date() });
    await n.save();
    res.json(n);
  } catch (e) {
    n.status = "failed"; await n.save();
    throw e;
  }
}
