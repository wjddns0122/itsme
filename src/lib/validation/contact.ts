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
