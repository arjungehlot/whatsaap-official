import crypto from "node:crypto";
import { WebhookDeliveryModel } from "../../models/WebhookDelivery.js";
import { WebhookEndpointModel } from "../../models/WebhookEndpoint.js";
import { ApiError } from "../../utils/apiError.js";

export const WEBHOOK_EVENTS = [
  { id: "message.sent", label: "Message sent", group: "Messages" },
  { id: "message.delivered", label: "Message delivered", group: "Messages" },
  { id: "message.read", label: "Message read", group: "Messages" },
  { id: "message.failed", label: "Message failed", group: "Messages" },
  { id: "message.received", label: "Message received", group: "Messages" },
  { id: "contact.created", label: "Contact created", group: "Contacts" },
  { id: "contact.updated", label: "Contact updated", group: "Contacts" },
  { id: "campaign.started", label: "Campaign started", group: "Campaigns" },
  { id: "campaign.completed", label: "Campaign completed", group: "Campaigns" },
  { id: "session.connected", label: "Session connected", group: "Connection" },
  { id: "session.disconnected", label: "Session disconnected", group: "Connection" },
];

function visibleEndpoint(endpoint, stats = {}) {
  const total = stats.total || 0;
  const successes = stats.successes || 0;
  const failures = stats.failures || 0;
  const successRate = total ? Math.round((successes / total) * 1000) / 10 : 100;
  const status = endpoint.status === "paused" ? "paused" : failures > 0 && successRate < 90 ? "failing" : "active";
  return {
    id: endpoint._id.toString(),
    name: endpoint.name,
    url: endpoint.url,
    description: endpoint.description || undefined,
    status,
    events: endpoint.events,
    version: endpoint.version,
    createdAt: endpoint.createdAt.toISOString(),
    lastDeliveryAt: stats.lastDeliveryAt?.toISOString(),
    successRate,
    deliveries24h: total,
    failures24h: failures,
    retries: endpoint.retries,
  };
}

async function endpointStats(endpointId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [rows, last] = await Promise.all([
    WebhookDeliveryModel.aggregate([
      { $match: { endpointId, at: { $gte: since } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    WebhookDeliveryModel.findOne({ endpointId }).sort({ at: -1 }).select("at").lean(),
  ]);
  return {
    total: rows.reduce((sum, row) => sum + row.count, 0),
    successes: rows.find((row) => row._id === "succeeded")?.count || 0,
    failures: rows.find((row) => row._id === "failed")?.count || 0,
    lastDeliveryAt: last?.at,
  };
}

function eventPayload(event, data, endpoint) {
  return {
    id: "evt_" + crypto.randomBytes(10).toString("hex"),
    type: event,
    api_version: endpoint.version,
    created_at: new Date().toISOString(),
    data,
  };
}

async function deliver(endpoint, event, requestBody, attempt = 1) {
  const delivery = await WebhookDeliveryModel.create({
    userId: endpoint.userId,
    endpointId: endpoint._id,
    event,
    status: "pending",
    attempt,
    at: new Date(),
    requestBody,
  });
  const rawBody = JSON.stringify(requestBody);
  const startedAt = Date.now();
  let responseCode = null;
  let responseBody = "";
  let error = "";
  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Whatsaap-Webhooks/1.0",
        "x-whatsaap-event": event,
        "x-whatsaap-delivery": delivery._id.toString(),
        "x-waflow-event": event,
        "x-waflow-delivery": delivery._id.toString(),
      },
      body: rawBody,
      signal: AbortSignal.timeout(10000),
    });
    responseCode = response.status;
    responseBody = (await response.text()).slice(0, 4000);
    if (!response.ok) error = "Endpoint returned HTTP " + response.status;
  } catch (requestError) {
    error = requestError instanceof Error ? requestError.message : "Webhook request failed";
  }
  const status = responseCode !== null && responseCode >= 200 && responseCode < 300 ? "succeeded" : "failed";
  await WebhookDeliveryModel.updateOne(
    { _id: delivery._id },
    { $set: { status, responseCode, durationMs: Date.now() - startedAt, responseBody, error } },
  );
  return { ...delivery.toObject(), status, responseCode, durationMs: Date.now() - startedAt, responseBody, error };
}

function visibleDelivery(delivery) {
  return {
    id: delivery._id.toString(),
    endpointId: delivery.endpointId.toString(),
    event: delivery.event,
    status: delivery.status,
    responseCode: delivery.responseCode,
    durationMs: delivery.durationMs,
    attempt: delivery.attempt,
    at: delivery.at.toISOString(),
    requestBody: delivery.requestBody,
    responseBody: delivery.responseBody,
    error: delivery.error || undefined,
  };
}

async function validateEvents(events) {
  const unknown = events.filter((id) => !WEBHOOK_EVENTS.some((item) => item.id === id));
  if (unknown.length) throw new ApiError(400, "Unsupported webhook event: " + unknown.join(", "));
}

export async function listWebhooks(userId) {
  const endpoints = await WebhookEndpointModel.find({ userId }).sort({ createdAt: -1 }).lean();
  return { endpoints: await Promise.all(endpoints.map(async (endpoint) => visibleEndpoint(endpoint, await endpointStats(endpoint._id)))), events: WEBHOOK_EVENTS };
}

export async function listDeliveries(userId, endpointId) {
  const endpoint = await WebhookEndpointModel.findOne({ _id: endpointId, userId }).lean();
  if (!endpoint) throw new ApiError(404, "Webhook endpoint not found");
  const deliveries = await WebhookDeliveryModel.find({ endpointId, userId }).sort({ at: -1 }).limit(100).lean();
  return { deliveries: deliveries.map(visibleDelivery) };
}

export async function createWebhook(userId, payload) {
  await validateEvents(payload.events);
  const endpoint = await WebhookEndpointModel.create({ ...payload, userId });
  return visibleEndpoint(endpoint.toObject());
}

export async function updateWebhook(userId, id, payload) {
  const endpoint = await WebhookEndpointModel.findOne({ _id: id, userId });
  if (!endpoint) throw new ApiError(404, "Webhook endpoint not found");
  if (payload.events) await validateEvents(payload.events);
  Object.assign(endpoint, payload);
  await endpoint.save();
  return visibleEndpoint(endpoint.toObject(), await endpointStats(endpoint._id));
}

export async function deleteWebhook(userId, id) {
  const endpoint = await WebhookEndpointModel.findOneAndDelete({ _id: id, userId });
  if (!endpoint) throw new ApiError(404, "Webhook endpoint not found");
  await WebhookDeliveryModel.deleteMany({ endpointId: id, userId });
}

export async function sendWebhookTest(userId, id) {
  const endpoint = await WebhookEndpointModel.findOne({ _id: id, userId }).lean();
  if (!endpoint) throw new ApiError(404, "Webhook endpoint not found");
  const event = endpoint.events[0] || "message.sent";
  const result = await deliver(endpoint, event, eventPayload(event, { test: true, message: "This is a Whatsaap test event." }, endpoint));
  return visibleDelivery(result);
}

export async function replayWebhookDelivery(userId, id) {
  const delivery = await WebhookDeliveryModel.findOne({ _id: id, userId }).lean();
  if (!delivery) throw new ApiError(404, "Webhook delivery not found");
  const endpoint = await WebhookEndpointModel.findOne({ _id: delivery.endpointId, userId }).lean();
  if (!endpoint) throw new ApiError(404, "Webhook endpoint not found");
  const result = await deliver(endpoint, delivery.event, delivery.requestBody, delivery.attempt + 1);
  return visibleDelivery(result);
}

export async function dispatchWebhookEvent(userId, event, data) {
  const endpoints = await WebhookEndpointModel.find({ userId, status: "active", events: event }).lean();
  await Promise.allSettled(endpoints.map((endpoint) => deliver(endpoint, event, eventPayload(event, data, endpoint))));
}
