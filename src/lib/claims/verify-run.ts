import "server-only";
import { getAi } from "@/lib/ai/client";
import { verifyOwnership } from "@/lib/ai/verify";
import { seoulDate } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { categoryLabel } from "@/lib/validation/constants";

/**
 * After a claim or a proof reply (FL-044): compare the answers with the private features and keep
 * the result in ai_verdict for A-06. Service role, scoped to this one candidate. Contact columns are
 * never selected. On failure ai_verdict stays null and the admin compares by hand.
 */
export async function runOwnershipCheck(candidateId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: c } = await supabase
    .from("match_candidates")
    .select("status, claim_answers, proof_reply, report:lost_reports(description, secret_detail), item:found_items(category, public_summary, private_features, found_area, found_at)")
    .eq("id", candidateId)
    .maybeSingle();
  if (!c || c.status !== "claimed" || !c.report || !c.item) return;

  let ai: ReturnType<typeof getAi>;
  try {
    ai = getAi();
  } catch {
    console.error(JSON.stringify({ event: "ai_not_configured", kind: "verify" }));
    return;
  }
  const answers = Array.isArray(c.claim_answers)
    ? c.claim_answers.flatMap((a) => (a && typeof a === "object" && "question" in a && "answer" in a ? [{ question: String(a.question), answer: String(a.answer) }] : []))
    : [];
  const result = await verifyOwnership({
    client: ai.client,
    model: ai.env.LLM_MODEL,
    input: {
      answers,
      proofReply: c.proof_reply,
      description: c.report.description,
      secretDetail: c.report.secret_detail,
      item: {
        category: categoryLabel(c.item.category),
        publicSummary: c.item.public_summary,
        privateFeatures: c.item.private_features,
        foundArea: c.item.found_area,
        foundDate: seoulDate(c.item.found_at),
      },
    },
  });
  if (!result.ok) return;
  const { error } = await supabase
    .from("match_candidates")
    .update({ ai_verdict: { ...result.verdict, ...result.raw, model: ai.env.LLM_MODEL } as Json })
    .eq("id", candidateId)
    .eq("status", "claimed");
  if (error) console.error(JSON.stringify({ event: "verify_save_failed", code: error.code }));
}
