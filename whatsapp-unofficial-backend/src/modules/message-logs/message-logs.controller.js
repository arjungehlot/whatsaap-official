import { retryOutboundDelivery } from "../messages/messages.service.js";
import {
  listOutboundMessageLogs,
  markOutboundMessageLogRetried,
  cancelPendingOutboundMessageLogs,
  retryableOutboundMessageLog,
} from "./message-logs.service.js";

export async function getMessageLogs(req, res) {
  res.json({
    success: true,
    data: await listOutboundMessageLogs(req.user._id, req.validated.query),
  });
}

export async function retryMessageLog(req, res) {
  const log = await retryableOutboundMessageLog(
    req.user._id,
    req.validated.params.id,
  );
  const result = await retryOutboundDelivery(req.user._id, log);
  await markOutboundMessageLogRetried(req.user._id, log._id);
  res.status(201).json({ success: true, data: result });
}

export async function cancelPendingMessageLogs(req, res) {
  res.json({
    success: true,
    data: await cancelPendingOutboundMessageLogs(
      req.user._id,
      req.validated.body.ids,
    ),
  });
}
