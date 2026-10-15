import { Router } from "express";

const receivedEvents = [];
const MAX_EVENTS = 100;

export const webhookTestRouter = Router();

webhookTestRouter.get("/testworkflow", (_req, res) => {
  res.json({ success: true, receiver: "Whatsaap webhook test receiver", received: receivedEvents });
});

webhookTestRouter.post("/testworkflow", (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body || {});
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (_error) {
    return res.status(400).json({ success: false, message: "Webhook body must be valid JSON" });
  }

  const event = {
    receivedAt: new Date().toISOString(),
    event: req.headers["x-whatsaap-event"] || req.headers["x-waflow-event"] || payload.type || "unknown",
    deliveryId: req.headers["x-whatsaap-delivery"] || req.headers["x-waflow-delivery"] || null,
    payload,
  };
  receivedEvents.unshift(event);
  receivedEvents.length = Math.min(receivedEvents.length, MAX_EVENTS);
  console.log("Webhook test receiver received event", event.event, event.deliveryId || "");
  return res.status(200).json({ success: true, received: true, event: event.event });
});
