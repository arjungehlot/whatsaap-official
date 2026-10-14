import { getInboxAttachment, getInboxGroupDetails, listInboxConversations, listInboxMessages, sendInboxMessage } from "./inbox.service.js";
import { uploadAttachmentToS3 } from "../templates/template-storage.service.js";

export async function getConversations(req, res, next) {
  try {
    const data = await listInboxConversations(req.user._id, req.validated.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getMessages(req, res, next) {
  try {
    const data = await listInboxMessages(req.user._id, req.validated.params.id, req.validated.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getGroupDetails(req, res, next) {
  try {
    const group = await getInboxGroupDetails(req.user._id, req.validated.params.id);
    res.json({ success: true, data: { group } });
  } catch (error) {
    next(error);
  }
}

export async function postMessage(req, res, next) {
  try {
    const messages = await sendInboxMessage(
      req.user._id,
      req.validated.params.id,
      req.validated.body.body,
      { chargeCredits: req.authType === "api-key", attachments: req.validated.body.attachments },
    );
    res.status(201).json({ success: true, data: { message: messages[0], messages } });
  } catch (error) {
    next(error);
  }
}

export async function postInboxAttachments(req, res, next) {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      res.status(400).json({ success: false, message: "Choose at least one file to upload" });
      return;
    }
    const totalBytes = files.reduce((total, file) => total + Math.max(0, Number(file.size) || 0), 0);
    if (totalBytes > 50 * 1024 * 1024) {
      res.status(400).json({ success: false, message: "Total attachment size cannot exceed 50 MB" });
      return;
    }
    const attachments = await Promise.all(files.map((file) => uploadAttachmentToS3(req.user._id, file)));
    res.status(201).json({ success: true, data: { attachments } });
  } catch (error) {
    next(error);
  }
}

export async function getAttachment(req, res, next) {
  try {
    const attachment = await getInboxAttachment(req.user._id, req.validated.params.id);
    const fileName = String(attachment.fileName || "attachment").replace(/[\r\n"]/g, "_");
    res.set({
      "Content-Type": attachment.mimeType || "application/octet-stream",
      "Content-Length": String(attachment.buffer.length),
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    });
    res.send(attachment.buffer);
  } catch (error) {
    next(error);
  }
}
