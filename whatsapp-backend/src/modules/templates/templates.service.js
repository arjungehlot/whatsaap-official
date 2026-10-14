import { MessageTemplateModel } from "../../models/MessageTemplate.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/apiError.js";

function visibleTemplate(template) {
  const attachments = template.attachments?.length
    ? template.attachments
    : template.attachment
      ? [template.attachment]
      : [];

  return {
    id: template._id.toString(),
    name: template.name,
    category: template.category,
    language: template.language,
    status: template.status,
    body: template.body,
    attachment: template.attachment
      ? {
          kind: template.attachment.kind,
          name: template.attachment.name,
          mimeType: template.attachment.mimeType,
          size: template.attachment.size,
        }
      : undefined,
    attachments: attachments.map((attachment) => ({
      kind: attachment.kind,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
    })),
    usageCount: template.usageCount,
    updatedAt: template.updatedAt.toISOString(),
  };
}

function attachmentFingerprint(attachment) {
  return [attachment.kind, attachment.name, attachment.mimeType, attachment.size].join("|");
}

function hydrateExistingAttachment(attachment, currentAttachments) {
  if (!attachment || attachment.key) return attachment;
  return currentAttachments.find((current) => attachmentFingerprint(current) === attachmentFingerprint(attachment));
}

function buildTemplateUpdate(payload) {
  const next = { ...payload };
  const shouldUnsetAttachment = next.attachment === null || next.attachments === null;
  if (shouldUnsetAttachment) delete next.attachment;
  if (shouldUnsetAttachment) delete next.attachments;
  return shouldUnsetAttachment
    ? { update: { $set: next, $unset: { attachment: "", attachments: "" } } }
    : { update: { $set: next } };
}

function cleanTemplatePayload(userId, payload) {
  const next = { ...payload };
  const attachments = next.attachments?.length
    ? next.attachments
    : next.attachment && next.attachment !== null
      ? [next.attachment]
      : [];
  if (next.attachment === null || next.attachments === null) return next;
  if (attachments.length === 0) return next;

  const expectedPrefix = `templates/${userId}/`;
  for (const attachment of attachments) {
    if (env.awsS3BucketName && attachment.bucket !== env.awsS3BucketName) {
      throw new ApiError(400, "Template attachment bucket is invalid");
    }
    if (!attachment.key?.startsWith(expectedPrefix)) {
      throw new ApiError(400, "Template attachment does not belong to this user");
    }
  }
  next.attachments = attachments;
  next.attachment = attachments[0];

  return next;
}

async function hydrateTemplatePayload(userId, templateId, payload) {
  if (!payload.attachments?.length && !payload.attachment) return payload;

  const template = await MessageTemplateModel.findOne({ _id: templateId, userId }).select("attachment attachments").lean();
  if (!template) throw new ApiError(404, "Template not found");

  const currentAttachments = template.attachments?.length
    ? template.attachments
    : template.attachment
      ? [template.attachment]
      : [];
  const next = { ...payload };

  if (Array.isArray(next.attachments)) {
    next.attachments = next.attachments.map((attachment) => hydrateExistingAttachment(attachment, currentAttachments) || attachment);
  }
  if (next.attachment && next.attachment !== null) {
    next.attachment = hydrateExistingAttachment(next.attachment, currentAttachments) || next.attachment;
  }

  return next;
}

export async function listTemplates(userId, filters = {}) {
  const query = { userId };
  const search = filters.search?.trim();

  if (filters.category && filters.category !== "all") query.category = filters.category;
  if (filters.status && filters.status !== "all") query.status = filters.status;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { body: { $regex: search, $options: "i" } },
      { language: { $regex: search, $options: "i" } },
    ];
  }

  const templates = await MessageTemplateModel.find(query).sort({ updatedAt: -1 }).lean();
  return templates.map(visibleTemplate);
}

export async function getTemplate(userId, templateId) {
  const template = await MessageTemplateModel.findOne({ _id: templateId, userId }).lean();
  if (!template) throw new ApiError(404, "Template not found");
  return visibleTemplate(template);
}

export async function createTemplate(userId, payload) {
  try {
    const template = await MessageTemplateModel.create({ userId, ...cleanTemplatePayload(userId, payload) });
    return visibleTemplate(template);
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, "A template with this name already exists");
    throw error;
  }
}

export async function updateTemplate(userId, templateId, payload) {
  try {
    const hydratedPayload = await hydrateTemplatePayload(userId, templateId, payload);
    const { update } = buildTemplateUpdate(cleanTemplatePayload(userId, hydratedPayload));
    const template = await MessageTemplateModel.findOneAndUpdate(
      { _id: templateId, userId },
      update,
      { returnDocument: "after", runValidators: true },
    );
    if (!template) throw new ApiError(404, "Template not found");
    return visibleTemplate(template);
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, "A template with this name already exists");
    throw error;
  }
}

export async function duplicateTemplate(userId, templateId, payload = {}) {
  const template = await MessageTemplateModel.findOne({ _id: templateId, userId }).lean();
  if (!template) throw new ApiError(404, "Template not found");

  return createTemplate(userId, {
    name: payload.name || `${template.name} Copy`,
    category: template.category,
    language: template.language,
    status: "draft",
    body: template.body,
    attachment: template.attachment,
    attachments: template.attachments?.length ? template.attachments : template.attachment ? [template.attachment] : [],
  });
}

export async function deleteTemplate(userId, templateId) {
  const result = await MessageTemplateModel.deleteOne({ _id: templateId, userId });
  if (result.deletedCount === 0) throw new ApiError(404, "Template not found");
}
