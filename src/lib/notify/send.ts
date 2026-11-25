import "server-only";
import type { Email } from "./templates";

// Resend over plain HTTP (no SDK needed for one call). Without RESEND_API_KEY / EMAIL_FROM nothing is
// sent and the caller carries on: a failed email never undoes matching or an approval (FL-050).
const RESEND_URL = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

export type EmailKind = "report_received" | "new_candidates" | "approved";

export async function sendEmail(to: string, email: Email, kind: EmailKind): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.info(JSON.stringify({ event: "email_skipped", kind, reason: "not_configured" }));
    return false;
  }
  try {
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: email.subject, text: email.text, html: email.html }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // Status only: never the address, the body or the key.
    console.info(JSON.stringify({ event: "email_sent", kind, ok: response.ok, status: response.status }));
    return response.ok;
  } catch {
    console.error(JSON.stringify({ event: "email_failed", kind }));
    return false;
  }
}

/** Absolute link for emails, e.g. the 신고 링크 /r/{token}. */
export function appUrl(path: string): string {
  return new URL(path, process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").toString();
}
