// contact_key: groups reports and inquiries from the same person (docs/04-architecture.md §6-4, F9-1).
// Never sent to people who lost something.

/** Digits only, a leading 82 becomes 0. Returns null when it cannot be a Korean phone number. */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("82")) digits = `0${digits.slice(2)}`;
  return /^0\d{8,10}$/.test(digits) ? digits : null;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Phone first (people change emails less often than they mistype them), otherwise email. */
export function toContactKey(contact: { phone?: string | null; email?: string | null }): string | null {
  const phone = contact.phone ? normalizePhone(contact.phone) : null;
  if (phone) return phone;
  const email = contact.email ? normalizeEmail(contact.email) : "";
  return email || null;
}

/** A-07 group header: "010-****-5678" or "mi***@example.com". Admin screens only. */
export function maskContactKey(key: string): string {
  if (/^\d+$/.test(key)) return `${key.slice(0, 3)}-****-${key.slice(-4)}`;
  const [local, domain] = key.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

/**
 * A-07 "연락처로 찾기": the last 4 digits of a phone number, a whole phone number, or an email.
 * Returns how to match `contact_key`, or null when the input is none of these.
 */
export function parseContactSearch(raw: string): { kind: "suffix" | "exact"; value: string } | null {
  const text = raw.trim();
  if (/^\d{4}$/.test(text)) return { kind: "suffix", value: text };
  const phone = normalizePhone(text);
  if (phone) return { kind: "exact", value: phone };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return { kind: "exact", value: normalizeEmail(text) };
  return null;
}
