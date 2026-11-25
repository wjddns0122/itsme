// A-06 소유권 확인 요청 (상세, 3단 비교)
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { ClaimDecisions } from "@/components/admin/claims/claim-decisions";
import { CandidateStatusBadge, ItemStatusBadge } from "@/components/admin/status-badge";
import { Icon } from "@/components/icon";
import { getAdminContext } from "@/lib/auth/admin";
import { CONTACT_CLAIM_WARNING, getClaimDetail, type ClaimDetail } from "@/lib/claims/admin";
import { formatWait } from "@/lib/claims/wait";
import { cn } from "@/lib/utils";
import { OwnershipVerdictSchema, type OwnershipVerdict } from "@/lib/validation/ai";
import ko from "../../../../../../messages/ko.json";

const t = ko.admin.claims;

export default function ClaimDetailPage({ params }: PageProps<"/admin/claims/[id]">) {
  return (
    <main className="flex flex-col gap-5 px-4 pt-6 pb-8 md:px-6">
      <Link href="/admin/claims" className="flex min-h-11 items-center gap-1 self-start text-desc text-ink-muted">
        <span aria-hidden>‹</span> {t.back}
      </Link>
      <Suspense fallback={<span role="status" className="text-desc text-ink-muted">{ko.admin.loading}</span>}>
        <Detail params={params} />
      </Suspense>
    </main>
  );
}

async function Detail({ params }: Pick<PageProps<"/admin/claims/[id]">, "params">) {
  await getAdminContext();
  const { id } = await params;
  const result = await getClaimDetail(id);
  await connection();
  if (result.status !== "ok") {
    return <p role="alert" className="text-body font-bold text-ink">{result.status === "not_found" ? t.notFound : t.loadError}</p>;
  }
  const { detail: c } = result;
  const title = [c.item.category, c.item.storageLocation].filter(Boolean).join(" · ");
  const open = c.status === "claimed" || c.status === "needs_proof";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-page font-bold tracking-[-0.01em] text-ink">{title}</h1>
        {/* Figma A-06: a request under review reads "확인 중" like the item it holds. */}
        {c.status === "claimed" ? <ItemStatusBadge status="claimed" /> : <CandidateStatusBadge status={c.status} />}
        {open && c.claimedAt ? <span className="text-desc text-ink-muted">{t.waitSuffix.replace("{wait}", formatWait(c.claimedAt, new Date()))}</span> : null}
      </div>

      {c.warnings.otherRequests > 0 ? <Warning text={t.warnOtherRequests.replace("{n}", String(c.warnings.otherRequests))} /> : null}
      {c.warnings.contactRecentItems >= CONTACT_CLAIM_WARNING.items ? <Warning text={t.warnContact.replace("{n}", String(c.warnings.contactRecentItems))} strong /> : null}
      {c.status === "approved" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-ui-md bg-ok-bg px-4 py-3">
          <p className="min-w-0 flex-1 text-desc font-bold text-ok">{t.approved}</p>
          <Link href={`/admin/items/${c.item.id}`} className="flex h-11 items-center rounded-ui-sm bg-brand px-4 text-button font-bold text-on-brand">
            {t.toItem}
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <Said detail={c} />
        <AiColumn verdict={OwnershipVerdictSchema.safeParse(c.aiVerdict).data ?? null} running={c.status === "claimed" && !c.aiVerdict && isRecent(c.claimedAt)} />
        <Stored detail={c} />
      </div>

      {open ? <ClaimDecisions id={c.id} status={c.status as "claimed" | "needs_proof"} subtitle={[title, c.report.contact.name].filter(Boolean).join(" · ")} bring={bringOf(c)} /> : null}
    </>
  );
}

function Said({ detail: c }: { detail: ClaimDetail }) {
  return (
    <Column title={t.said}>
      <Field label={t.original}>{c.report.description || "—"}</Field>
      {c.report.secretDetail ? <Highlight label={t.secret}>{c.report.secretDetail}</Highlight> : null}
      <div className="flex flex-col gap-2">
        <span className="text-caption font-bold text-ink-muted">{t.answers}</span>
        {c.answers.map((a) => (
          <div key={a.key} className="flex flex-col gap-0.5">
            <span className="text-caption font-medium text-ink-muted">{a.question}</span>
            <span className="text-body whitespace-pre-line text-ink">{a.answer}</span>
          </div>
        ))}
      </div>
      {c.proof.request ? <Field label={t.proofRequest}>{c.proof.request}</Field> : null}
      {c.proof.reply ? <Field label={t.proofReply}>{c.proof.reply}</Field> : null}
      {c.claimPhotoUrl || c.proof.photoUrl ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-caption font-bold text-ink-muted">{t.photo}</span>
          <div className="flex gap-2">
            {[c.claimPhotoUrl, c.proof.photoUrl].filter((u): u is string => Boolean(u)).map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="relative size-[88px] overflow-hidden rounded-ui-md bg-neutral-bg">
                <Image src={url} alt={t.photoAlt} fill unoptimized className="object-cover" />
              </a>
            ))}
          </div>
        </div>
      ) : null}
      <Field label={t.contact}>{[c.report.contact.name, c.report.contact.email, c.report.contact.phone].filter(Boolean).join(" · ")}</Field>
      {c.reviewNote ? <Field label={t.reviewNote}>{c.reviewNote}</Field> : null}
    </Column>
  );
}

const VERDICT_TONE = { match: "border-ok text-ok", mismatch: "border-danger text-danger", unknown: "border-line-strong text-ink" } as const;
/** ai_verdict is written in after(); for a couple of minutes a missing result means it is still running. */
const AI_PENDING_MS = 2 * 60_000;

function isRecent(iso: string | null): boolean {
  return iso !== null && Date.now() - new Date(iso).getTime() < AI_PENDING_MS;
}

/** §9 AI 비교 (참고용, Figma 29:4924). It never decides; without a result the admin compares directly. */
function AiColumn({ verdict, running }: { verdict: OwnershipVerdict | null; running: boolean }) {
  return (
    <section className="flex flex-col gap-3 rounded-ui-md border-[1.5px] border-dashed border-line-strong p-4">
      <h2 className="flex items-center gap-2 text-section font-bold tracking-[-0.01em] text-ink">
        {t.ai}
        <span className="rounded-[6px] bg-neutral-bg px-1.5 text-caption font-bold text-neutral-ink">{t.aiTag}</span>
        {verdict?.insufficient ? <span className="rounded-[6px] bg-warn-bg px-1.5 text-caption font-bold text-butter-ink">{t.insufficient}</span> : null}
      </h2>
      {verdict ? (
        <>
          <ul className="flex flex-col">
            {verdict.items.map((i) => (
              <li key={i.key} className="flex flex-col gap-1 border-b border-line py-2.5 first:pt-0">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-label font-bold text-ink">{t.verdictKeys[i.key]}</span>
                  <span className={cn("flex items-center gap-1 rounded-ui-pill border bg-surface px-2 py-0.5 text-caption font-bold", VERDICT_TONE[i.result])}>
                    {i.result === "match" ? <span aria-hidden>✓</span> : null}
                    {t.verdictResults[i.result]}
                  </span>
                </span>
                {i.note ? <span className="text-caption font-medium text-ink-muted">{i.note}</span> : null}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-1">
            <span className="text-caption font-bold text-ink-muted">{t.opinion}</span>
            <p className="text-body text-ink">{verdict.summary}</p>
          </div>
        </>
      ) : (
        <p role="status" className="text-desc text-ink">{running ? t.aiRunning : t.aiNone}</p>
      )}
      <p className="text-caption font-medium text-ink-muted">{t.aiNotice}</p>
    </section>
  );
}

function Stored({ detail: c }: { detail: ClaimDetail }) {
  return (
    <Column title={t.stored}>
      <div className="relative flex aspect-[215/138] items-center justify-center overflow-hidden rounded-ui-md bg-neutral-bg">
        {c.item.photoUrl ? (
          <Image src={c.item.photoUrl} alt={t.itemPhoto} fill unoptimized className="object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-caption font-medium text-ink-muted">
            <Icon name="image" size={24} />
            {t.itemPhoto}
          </span>
        )}
      </div>
      <Field label={t.summary}>{c.item.summary}</Field>
      <Highlight label={t.private} lock>
        {c.item.privateFeatures.join(", ") || ko.admin.item.none}
      </Highlight>
      <Field label={t.requiredProof}>{proofText(c)}</Field>
    </Column>
  );
}

function proofText(c: ClaimDetail): string {
  if (c.item.requiredProof) return t.proofs[c.item.requiredProof];
  return c.item.categoryCode === "electronics.earphones" ? t.proofs.earphones : t.proofs.none;
}

/** Proof to bring, filled into the approve dialog automatically (docs/05-ai-matching.md §9-1). */
function bringOf(c: ClaimDetail): string {
  const proofs = { unlock_serial: [ko.admin.return.methods.unlock, ko.admin.return.methods.serial], id_check: [ko.admin.return.methods.id_check] } as const;
  return c.item.requiredProof ? proofs[c.item.requiredProof].join(", ") : "";
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-ui-md border border-line bg-surface p-4">
      <h2 className="text-section font-bold tracking-[-0.01em] text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-caption font-bold text-ink-muted">{label}</span>
      <span className="text-body whitespace-pre-line text-ink">{children}</span>
    </div>
  );
}

function Highlight({ label, children, lock }: { label: string; children: ReactNode; lock?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-ui-md bg-butter px-3 py-2.5">
      <span className="text-caption font-bold text-butter-ink">{label}</span>
      {lock ? (
        <span className="flex items-center gap-1 text-caption font-medium text-butter-ink">
          <Icon name="lock" size={14} />
          {t.adminOnly}
        </span>
      ) : null}
      <span className="text-body font-bold whitespace-pre-line text-ink">{children}</span>
    </div>
  );
}

function Warning({ text, strong }: { text: string; strong?: boolean }) {
  return (
    <p role="status" className={cn("flex items-center gap-2 rounded-ui-md px-4 py-3 text-label font-bold", strong ? "bg-warn-bg text-butter-ink" : "bg-info-bg text-info")}>
      <Icon name="alert-circle" size={18} />
      {text}
    </p>
  );
}
