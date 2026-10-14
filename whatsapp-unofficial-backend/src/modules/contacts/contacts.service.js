import { ContactModel } from "../../models/Contact.js";
import { ApiError } from "../../utils/apiError.js";
import { dispatchWebhookEvent } from "../webhooks/webhooks.service.js";

const DEFAULT_LIMIT = 50;
const DEFAULT_COUNTRY_CODE = "91";

export function normalizePhone(phone) {
  const raw = String(phone || "").trim();
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  while (digits.startsWith("0") && digits.length > 10) digits = digits.slice(1);
  if (!raw.startsWith("+") && digits.length === 10) digits = `${DEFAULT_COUNTRY_CODE}${digits}`;
  if (digits.length < 10) {
    throw new ApiError(400, "Phone number must include at least 10 digits");
  }
  return digits;
}

function formatPhone(phone) {
  return `+${normalizePhone(phone)}`;
}

function visibleContact(contact) {
  const customFields =
    contact.customFields instanceof Map
      ? Object.fromEntries(contact.customFields)
      : contact.customFields && typeof contact.customFields === "object"
        ? contact.customFields
        : {};

  return {
    id: contact._id.toString(),
    name: contact.name,
    phone: contact.phone,
    email: contact.email || undefined,
    dateOfBirth: contact.dateOfBirth || undefined,
    avatarUrl: contact.avatarUrl || undefined,
    tags: contact.tags || [],
    source: contact.source,
    status: contact.status,
    lastContactedAt: contact.lastContactedAt?.toISOString(),
    createdAt: contact.createdAt.toISOString(),
    notes: contact.notes || undefined,
    customFields,
  };
}

function cleanPayload(payload) {
  const next = { ...payload };
  if (typeof next.email === "string" && !next.email.trim()) delete next.email;
  if (typeof next.dateOfBirth === "string") {
    if (!next.dateOfBirth.trim()) delete next.dateOfBirth;
    else {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(next.dateOfBirth.trim());
      const date = match ? new Date(`${next.dateOfBirth.trim()}T00:00:00.000Z`) : undefined;
      if (!match || Number.isNaN(date?.getTime()) || date.toISOString().slice(0, 10) !== next.dateOfBirth.trim()) throw new ApiError(400, "Date of birth must be a valid YYYY-MM-DD date");
      next.dateOfBirth = next.dateOfBirth.trim();
    }
  }
  if (next.tags) next.tags = [...new Set(next.tags.map((tag) => tag.trim()).filter(Boolean))];
  if (next.phone) {
    next.normalizedPhone = normalizePhone(next.phone);
    next.phone = formatPhone(next.phone);
  }
  return next;
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function splitTags(value) {
  return String(value || "")
    .split(/[;,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function rowValue(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function rawRowValue(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return "";
}

function normalizeImportedDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new ApiError(400, "Date of birth must be a valid date");
    return value.toISOString().slice(0, 10);
  }
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(text);
  if (!match) throw new ApiError(400, "Date of birth must use YYYY-MM-DD or a valid Excel date");
  const first = Number(match[1]);
  const second = Number(match[2]);
  // India-friendly interpretation for ambiguous slash dates: DD/MM/YYYY.
  const day = first > 12 ? first : second > 12 ? second : first;
  const month = first > 12 ? second : second > 12 ? first : second;
  const date = new Date(Date.UTC(Number(match[3]), month - 1, day));
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== `${match[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`) {
    throw new ApiError(400, "Date of birth must be a valid date");
  }
  return date.toISOString().slice(0, 10);
}

function rowToContactPayload(row) {
  const name = rowValue(row, ["name", "full_name", "contact_name"]);
  const phone = rowValue(row, ["phone", "whatsapp_number", "mobile", "mobile_number", "number"]);
  const email = rowValue(row, ["email", "email_id"]);
  const dateOfBirth = normalizeImportedDate(rawRowValue(row, ["date_of_birth", "dob", "birth_date", "dateofbirth"]));
  const tags = splitTags(rowValue(row, ["tags", "tag"]));
  const source = rowValue(row, ["source"]) || "CSV Import";
  const status = rowValue(row, ["status"]) || "active";
  const notes = rowValue(row, ["notes", "note"]);
  const knownKeys = new Set([
    "name",
    "full_name",
    "contact_name",
    "phone",
    "whatsapp_number",
    "mobile",
    "mobile_number",
    "number",
    "email",
    "email_id",
    "date_of_birth",
    "dob",
    "birth_date",
    "dateofbirth",
    "tags",
    "tag",
    "source",
    "status",
    "notes",
    "note",
  ]);
  const customFields = Object.fromEntries(
    Object.entries(row)
      .filter(([key, value]) => !knownKeys.has(key) && value !== undefined && value !== null && String(value).trim())
      .map(([key, value]) => [key, String(value).trim()]),
  );

  return {
    name,
    phone,
    email: email || undefined,
    dateOfBirth: dateOfBirth || undefined,
    tags,
    source,
    status: status.toLowerCase(),
    notes: notes || undefined,
    customFields,
  };
}

export async function listContacts(userId, filters = {}) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || DEFAULT_LIMIT, 1), 100);
  const query = { userId };
  const search = filters.search?.trim();

  if (filters.status && filters.status !== "all") query.status = filters.status;
  if (filters.tag && filters.tag !== "all") query.tags = filters.tag;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search.replace(/\s/g, ""), $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { tags: { $regex: search, $options: "i" } },
    ];
  }

  const [rows, total, stats, tagRows] = await Promise.all([
    ContactModel.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ContactModel.countDocuments(query),
    ContactModel.aggregate([
      { $match: { userId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    ContactModel.distinct("tags", { userId }),
  ]);

  const byStatus = Object.fromEntries(stats.map((row) => [row._id, row.count]));
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const newThisMonth = await ContactModel.countDocuments({ userId, createdAt: { $gte: startOfMonth } });

  return {
    contacts: rows.map(visibleContact),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    tags: tagRows.sort(),
    stats: {
      total: (byStatus.active || 0) + (byStatus.inactive || 0) + (byStatus.blocked || 0),
      active: byStatus.active || 0,
      inactive: byStatus.inactive || 0,
      blocked: byStatus.blocked || 0,
      newThisMonth,
    },
  };
}

export async function getContact(userId, contactId) {
  const contact = await ContactModel.findOne({ _id: contactId, userId }).lean();
  if (!contact) throw new ApiError(404, "Contact not found");
  return visibleContact(contact);
}

export async function createContact(userId, payload) {
  try {
    const contact = await ContactModel.create({ userId, ...cleanPayload(payload) });
    void dispatchWebhookEvent(userId, "contact.created", visibleContact(contact)).catch(() => {});
    return visibleContact(contact);
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, "A contact with this phone number already exists");
    throw error;
  }
}

export async function importContacts(userId, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new ApiError(400, "The uploaded file does not contain any contact rows");
  }

  const summary = {
    total: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const [index, rawRow] of rows.entries()) {
    const rowNumber = index + 2;
    const row = Object.fromEntries(Object.entries(rawRow).map(([key, value]) => [normalizeHeader(key), value]));
    let payload;
    try {
      payload = rowToContactPayload(row);
    } catch (error) {
      summary.skipped += 1;
      summary.errors.push({ row: rowNumber, message: error.message || "Invalid date of birth" });
      continue;
    }

    if (!payload.name || !payload.phone) {
      summary.skipped += 1;
      summary.errors.push({ row: rowNumber, message: "Missing required name or phone" });
      continue;
    }

    if (!["Manual", "CSV Import", "Website Form", "API", "WhatsApp"].includes(payload.source)) {
      payload.source = "CSV Import";
    }

    if (!["active", "inactive", "blocked"].includes(payload.status)) {
      payload.status = "active";
    }

    let clean;
    try {
      clean = cleanPayload(payload);
    } catch (error) {
      summary.skipped += 1;
      summary.errors.push({ row: rowNumber, message: error.message || "Invalid phone number" });
      continue;
    }

    const result = await ContactModel.updateOne(
      { userId, normalizedPhone: clean.normalizedPhone },
      { $set: clean, $setOnInsert: { userId } },
      { upsert: true, runValidators: true },
    );

    if (result.upsertedCount > 0) summary.created += 1;
    else summary.updated += 1;
  }

  return summary;
}

export async function updateContact(userId, contactId, payload) {
  try {
    const contact = await ContactModel.findOneAndUpdate(
      { _id: contactId, userId },
      { $set: cleanPayload(payload) },
      { returnDocument: "after", runValidators: true },
    );
    if (!contact) throw new ApiError(404, "Contact not found");
    void dispatchWebhookEvent(userId, "contact.updated", visibleContact(contact)).catch(() => {});
    return visibleContact(contact);
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, "A contact with this phone number already exists");
    throw error;
  }
}

export async function deleteContact(userId, contactId) {
  const result = await ContactModel.deleteOne({ _id: contactId, userId });
  if (result.deletedCount === 0) throw new ApiError(404, "Contact not found");
}

export async function bulkDeleteContacts(userId, ids) {
  const result = await ContactModel.deleteMany({ _id: { $in: ids }, userId });
  return { deleted: result.deletedCount };
}
