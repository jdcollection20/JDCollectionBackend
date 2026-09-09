import webpush from "../config/push.js";
import PushSubscription from "../models/PushSubscription.js";

export async function sendToAll(payload) {
  const subscriptions = await PushSubscription.find({}).lean();
  const results = await Promise.allSettled(
    subscriptions.map(s => webpush.sendNotification(s, JSON.stringify(payload)))
  );

  let successCount = 0, failureCount = 0;
  const invalidEndpoints = [];

  results.forEach((result, i) => {
    if (result.status === "fulfilled") successCount++;
    else {
      failureCount++;
      const code = result.reason?.statusCode;
      if (code === 404 || code === 410) invalidEndpoints.push(subscriptions[i].endpoint);
    }
  });

  if (invalidEndpoints.length) {
    await PushSubscription.deleteMany({ endpoint: { $in: invalidEndpoints } });
  }
  return { recipientCount: subscriptions.length, successCount, failureCount };
}
