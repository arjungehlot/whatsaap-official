import crypto from "node:crypto";
import { OutboundMessageBatchModel } from "../../models/OutboundMessageBatch.js";
import { OutboundMessageLogModel } from "../../models/OutboundMessageLog.js";
import { ApiError } from "../../utils/apiError.js";

function countsFor(rows) {
  const counts = { queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
  for (const row of rows) {
    const status = String(
      row.deliveryStatus || row.status || "pending",
    ).toLowerCase();
    if (status === "pending" || status === "processing") counts.queued += 1;
    else if (status === "read") {
      counts.read += 1;
      counts.delivered += 1;
      counts.sent += 1;
    } else if (status === "delivered") {
      counts.delivered += 1;
      counts.sent += 1;
    } else if (status === "sent") counts.sent += 1;
    else if (["failed", "cancelled"].includes(status)) counts.failed += 1;
  }
  return counts;
}

function batchStatus(counts, total) {
  if (!total || counts.queued > 0)
    return counts.sent || counts.delivered || counts.read
      ? "sending"
      : "queued";
  if (counts.failed === total) return "failed";
  if (counts.failed > 0) return "partial";
  return "completed";
}

export function hashIdempotencyValue(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export function stablePayloadHash(value) {
  const normalize = (input) => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === "object") {
      return Object.fromEntries(
        Object.keys(input)
          .sort()
          .map((key) => [key, normalize(input[key])]),
      );
    }
    return input;
  };
  return hashIdempotencyValue(JSON.stringify(normalize(value)));
}

export async function createOrReuseOutboundBatch({
  userId,
  apiKeyId,
  idempotencyKey,
  requestHash,
  recipientCount,
  duplicatesIgnored,
}) {
  const normalizedKey = String(idempotencyKey || "").trim();
  if (!normalizedKey) {
    return {
      batch: await OutboundMessageBatchModel.create({
        userId,
        apiKeyId,
        recipientCount,
        duplicatesIgnored,
      }),
      replayed: false,
    };
  }
  if (normalizedKey.length > 200)
    throw new ApiError(400, "Idempotency-Key must be 200 characters or fewer");

  const idempotencyScope = apiKeyId ? `key:${apiKeyId}` : "session";
  const idempotencyKeyHash = hashIdempotencyValue(normalizedKey);
  const existing = await OutboundMessageBatchModel.findOne({
    userId,
    idempotencyScope,
    idempotencyKeyHash,
  });
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new ApiError(
        409,
        "This Idempotency-Key was already used with a different request payload",
      );
    }
    return { batch: existing, replayed: true };
  }

  try {
    const batch = await OutboundMessageBatchModel.create({
      userId,
      apiKeyId,
      idempotencyScope,
      idempotencyKeyHash,
      requestHash,
      recipientCount,
      duplicatesIgnored,
    });
    return { batch, replayed: false };
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const raced = await OutboundMessageBatchModel.findOne({
      userId,
      idempotencyScope,
      idempotencyKeyHash,
    });
    if (!raced || raced.requestHash !== requestHash) {
      throw new ApiError(
        409,
        "This Idempotency-Key was already used with a different request payload",
      );
    }
    return { batch: raced, replayed: true };
  }
}

export async function refreshOutboundBatch(batchId) {
  if (!batchId) return null;
  const [batch, rows] = await Promise.all([
    OutboundMessageBatchModel.findById(batchId),
    OutboundMessageLogModel.find({ batchId, isDeliverySummary: true })
      .select("status deliveryStatus deliveryError")
      .lean(),
  ]);
  if (!batch) return null;

  const counts = countsFor(rows);
  const status = batchStatus(counts, batch.recipientCount);
  batch.queued = counts.queued;
  batch.sent = counts.sent;
  batch.delivered = counts.delivered;
  batch.read = counts.read;
  batch.failed = counts.failed;
  batch.status = status;
  batch.lastError = rows.find((row) => row.deliveryError)?.deliveryError;
  batch.completedAt = ["completed", "partial", "failed"].includes(status)
    ? new Date()
    : undefined;
  await batch.save();
  return batch;
}

export async function finalizeOutboundBatch(
  batchId,
  responsePayload,
  channelId,
) {
  if (!batchId) return null;
  await OutboundMessageBatchModel.updateOne(
    { _id: batchId },
    { $set: { ...(channelId ? { channelId } : {}) } },
  );

  const batch = await refreshOutboundBatch(batchId);
  if (!batch) return null;

  // Persist the completed result used by idempotent retries, including the
  // initial per-recipient delivery summary.
  if (responsePayload?.delivery) {
    responsePayload.delivery.batch = visibleOutboundBatch(batch);
  }
  await OutboundMessageBatchModel.updateOne(
    { _id: batchId },
    { $set: { responsePayload } },
  );
  return batch;
}

export async function failOutboundBatch(batchId, error) {
  if (!batchId) return;
  await OutboundMessageBatchModel.updateOne(
    { _id: batchId },
    {
      $set: {
        status: "failed",
        lastError:
          error instanceof Error ? error.message : "Batch preparation failed",
        completedAt: new Date(),
      },
    },
  );
}

export function visibleOutboundBatch(batch) {
  return {
    id: batch._id.toString(),
    channelId: batch.channelId || undefined,
    status: batch.status,
    recipients: batch.recipientCount,
    duplicatesIgnored: batch.duplicatesIgnored || 0,
    queued: batch.queued || 0,
    sent: batch.sent || 0,
    delivered: batch.delivered || 0,
    read: batch.read || 0,
    failed: batch.failed || 0,
    lastError: batch.lastError || undefined,
    createdAt: batch.createdAt?.toISOString(),
    completedAt: batch.completedAt?.toISOString(),
  };
}

export async function getOutboundBatch(userId, batchId, apiKeyId) {
  const batch = await OutboundMessageBatchModel.findOne({
    _id: batchId,
    userId,
  });
  if (!batch) throw new ApiError(404, "Message batch was not found");
  if (apiKeyId && batch.apiKeyId?.toString() !== apiKeyId.toString()) {
    throw new ApiError(403, "This API key cannot access this message batch");
  }
  return visibleOutboundBatch((await refreshOutboundBatch(batch._id)) || batch);
}
