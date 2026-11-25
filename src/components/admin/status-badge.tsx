import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";
import ko from "../../../messages/ko.json";

type FoundStatus = Database["public"]["Enums"]["found_status"];
type CandidateStatus = Database["public"]["Enums"]["candidate_status"];

// Badge colors from the Figma A-04 table (docs/03-screens.md §1 상태 배지).
const ITEM_TONE: Record<FoundStatus, string> = {
  stored: "bg-neutral-bg text-neutral-ink",
  claimed: "bg-info-bg text-info",
  returned: "bg-ok-bg text-ok",
  transferred: "bg-violet-bg text-violet",
  disposed: "bg-neutral-bg text-neutral-ink",
};

const CANDIDATE_TONE: Record<CandidateStatus, string> = {
  suggested: "bg-blush text-blush-ink",
  claimed: "bg-blush text-blush-ink",
  needs_proof: "bg-warn-bg text-butter-ink",
  approved: "bg-ok-bg text-ok",
  rejected: "bg-neutral-bg text-neutral-ink",
  dismissed: "bg-neutral-bg text-neutral-ink",
};

const pill = "inline-flex shrink-0 items-center rounded-ui-pill px-[9px] py-0.5 text-caption font-bold whitespace-nowrap";

export function ItemStatusBadge({ status }: { status: FoundStatus }) {
  return <span className={cn(pill, ITEM_TONE[status])}>{ko.itemStatus[status]}</span>;
}

export function CandidateStatusBadge({ status }: { status: CandidateStatus }) {
  return <span className={cn(pill, CANDIDATE_TONE[status])}>{ko.candidateStatus[status]}</span>;
}

export function CountBadge({ label }: { label: string }) {
  return <span className={cn(pill, "bg-blush text-blush-ink")}>{label}</span>;
}

export function SimilarityBadge({ high }: { high: boolean }) {
  return (
    <span className={cn(pill, high ? "bg-butter text-butter-ink" : "bg-neutral-bg text-neutral-ink")}>
      {high ? ko.public.status.similarity.high : ko.public.status.similarity.medium}
    </span>
  );
}
