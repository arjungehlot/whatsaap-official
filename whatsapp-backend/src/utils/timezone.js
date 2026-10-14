export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export function isValidTimezone(timezone) {
  if (!timezone || typeof timezone !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

export function requireTimezone(timezone = DEFAULT_TIMEZONE) {
  if (!isValidTimezone(timezone)) throw new Error(`Invalid timezone: ${timezone}`);
  return timezone;
}

function partsFor(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

export function zonedParts(date, timezone = DEFAULT_TIMEZONE) {
  const parts = partsFor(date, requireTimezone(timezone));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second) };
}

function timezoneOffsetMs(date, timezone) {
  const parts = zonedParts(date, timezone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - date.getTime();
}

export function localDateTimeToUtc(value, timezone = DEFAULT_TIMEZONE) {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const text = String(value).trim();
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(text)) {
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) throw new Error("Invalid scheduled date");
    return parsed;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  if (!match) throw new Error("Scheduled date must be in YYYY-MM-DDTHH:mm format");
  const naiveUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0));
  const first = new Date(naiveUtc - timezoneOffsetMs(new Date(naiveUtc), timezone));
  const corrected = new Date(naiveUtc - timezoneOffsetMs(first, timezone));
  if (Number.isNaN(corrected.getTime())) throw new Error("Invalid scheduled date");
  return corrected;
}

export function localDateKey(date, timezone = DEFAULT_TIMEZONE) {
  const parts = zonedParts(date, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function isDueAtTime(time, date, timezone = DEFAULT_TIMEZONE) {
  const [hour, minute] = String(time || "09:00").split(":").map(Number);
  const parts = zonedParts(date, timezone);
  return parts.hour > hour || (parts.hour === hour && parts.minute >= minute);
}
