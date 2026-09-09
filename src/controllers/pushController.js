import PushSubscription from "../models/PushSubscription.js";
import { env } from "../config/env.js";

export function publicKey(req, res) {
  res.json({ publicKey: env.VAPID_PUBLIC_KEY });
}

export async function subscribe(req, res) {
  const { endpoint, expirationTime, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ message: "Invalid push subscription" });
  const doc = await PushSubscription.findOneAndUpdate(
    { endpoint },
    { endpoint, expirationTime: expirationTime ? new Date(expirationTime) : null, keys },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.status(201).json({ id: doc._id });
}

export async function unsubscribe(req, res) {
  await PushSubscription.deleteOne({ endpoint: req.body.endpoint });
  res.json({ message: "Unsubscribed" });
}
