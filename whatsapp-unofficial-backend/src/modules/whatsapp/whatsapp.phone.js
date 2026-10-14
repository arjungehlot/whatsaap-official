export function normalizeWhatsAppPhone(value) {
  const raw = String(value || "").trim();
  let digits = raw.replace(/\D/g, "");

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!raw.startsWith("+") && digits.length === 10) digits = `91${digits}`;

  return digits;
}

export function sameWhatsAppPhone(left, right) {
  const normalizedLeft = normalizeWhatsAppPhone(left);
  const normalizedRight = normalizeWhatsAppPhone(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}
