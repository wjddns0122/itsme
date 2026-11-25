import ko from "../../../messages/ko.json";

// Email texts (docs/04-architecture.md §8). Built only from the public allowlist (§9-2): no photos,
// private features, scores or AI results. Pure, so the allowlist is tested.

const t = ko.email;

export type Email = { subject: string; text: string; html: string };

export type PublicItem = { category: string; summary: string | null; foundDate: string | null; foundArea: string | null };
export type Pickup = { desk: string | null; hours: string | null; bring: string | null; contact: string | null; note: string | null };

export function reportReceivedEmail(input: { facilityName: string; link: string }): Email {
  return build(t.received.subject, [t.received.body.replace("{facility}", input.facilityName), t.linkHint], input.link, t.received.button);
}

export function newCandidatesEmail(input: { facilityName: string; link: string; items: readonly PublicItem[] }): Email {
  const lines = input.items.map((i) => `• ${[i.summary ?? i.category, i.foundDate ? t.foundOn.replace("{date}", i.foundDate) : null, i.foundArea].filter(Boolean).join(" · ")}`);
  return build(t.candidates.subject, [t.candidates.body.replace("{facility}", input.facilityName), ...lines, t.candidates.next], input.link, t.candidates.button);
}

export function approvedEmail(input: { facilityName: string; link: string; pickup: Pickup }): Email {
  const p = input.pickup;
  const rows = [
    [t.approved.desk, p.desk],
    [t.approved.hours, p.hours],
    [t.approved.bring, p.bring],
    [t.approved.contact, p.contact],
    [t.approved.note, p.note],
  ].flatMap(([label, value]) => (value ? [`${label}: ${value}`] : []));
  return build(t.approved.subject, [t.approved.body.replace("{facility}", input.facilityName), ...rows], input.link, t.approved.button);
}

function build(subject: string, lines: readonly string[], link: string, button: string): Email {
  const text = [...lines, "", `${button}: ${link}`, "", t.footer].join("\n");
  const html = [
    `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#3b2624">`,
    ...lines.map((l) => `<p style="margin:0 0 8px">${escapeHtml(l)}</p>`),
    `<p style="margin:16px 0"><a href="${escapeHtml(link)}" style="background:#c23f36;color:#fff;padding:10px 16px;border-radius:12px;text-decoration:none;font-weight:700">${escapeHtml(button)}</a></p>`,
    `<p style="margin:0;color:#7a605b;font-size:12px">${escapeHtml(t.footer)}</p>`,
    `</div>`,
  ].join("");
  return { subject, text, html };
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}
