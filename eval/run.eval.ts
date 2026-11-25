// pnpm eval — matching evaluation (docs/05-ai-matching.md §7-3). Calls Gemini for real: costs money,
// run it only when a person asked for it (CLAUDE.md §7). With a free-tier key send team test data only.
//
// 1. creates an evaluation facility (slug eval-YYYYMMDD, example name) apart from real data
// 2. registers every item in eval/cases.json with real photo analysis, then every report, and matches
// 3. writes eval/results/YYYY-MM-DD.md and prints the summary
// 4. deletes the facility (and with it items, reports, candidates, events) unless EVAL_KEEP=1
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { z } from "zod";
import { getAi } from "@/lib/ai/client";
import { extractFoundItem } from "@/lib/ai/extract";
import { DEFAULT_MATCH_CONFIG } from "@/lib/matching/config";
import { processReport } from "@/lib/matching/process";
import { defaultMatchDeps, matchForReport } from "@/lib/matching/run";
import { buildSearchText } from "@/lib/matching/search-text";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORY_CODES } from "@/lib/validation/constants";
import { extractionSummary, pct, stability, summarize, type ExtractionOutcome, type ReportOutcome, type Split } from "./metrics";

const ROOT = join(__dirname, "..");
const CasesSchema = z.object({
  items: z.array(
    z.object({
      key: z.string(),
      photos: z.array(z.string()).min(1),
      found_at: z.string(),
      found_area: z.string().nullable(),
      truth: z.object({ category: z.enum(CATEGORY_CODES), colors: z.array(z.string()) }),
    }),
  ),
  reports: z.array(
    z.object({
      key: z.string(),
      description: z.string(),
      secret_detail: z.string().nullable().optional(),
      user_category: z.string().nullable().optional(),
      lost_from: z.string(),
      lost_to: z.string(),
      lost_area: z.string().nullable(),
      expected_item: z.string().nullable(),
      split: z.enum(["dev", "test"]),
    }),
  ),
});

test("matching evaluation", { timeout: 60 * 60 * 1000 }, async () => {
  // No emails from an evaluation run, whatever .env.local says.
  process.env.RESEND_API_KEY = "";
  const cases = CasesSchema.parse(JSON.parse(readFileSync(join(ROOT, "eval/cases.json"), "utf8")));
  const supabase = createAdminClient();
  const day = new Date().toISOString().slice(0, 10);
  const slug = `eval-${day.replaceAll("-", "")}-${Date.now().toString(36)}`;
  const areas = [...new Set([...cases.items.map((i) => i.found_area), ...cases.reports.map((r) => r.lost_area)].filter((a): a is string => Boolean(a)))];

  const { data: facility, error } = await supabase
    .from("facilities")
    .insert({ slug, name: `평가용 시설 ${day} (예시)`, type: "school", areas, is_listed: false })
    .select("id")
    .single();
  expect(error).toBeNull();
  if (!facility) return;

  try {
    const { client, env } = getAi();
    const itemIds = new Map<string, string>();
    const extraction: ExtractionOutcome[] = [];
    let tokens = 0;

    for (const item of cases.items) {
      const photos = item.photos.map((p) => ({ mimeType: "image/jpeg", base64: readFileSync(join(ROOT, p)).toString("base64") }));
      const result = await extractFoundItem({ client, model: env.VISION_MODEL, photos, facilityType: "school", foundArea: item.found_area });
      const x = result.ok ? result.extraction : null;
      tokens += totalTokens(result.ok ? result.raw.usage : null);
      extraction.push({ truthCategory: item.truth.category, category: x?.category ?? null, truthColors: item.truth.colors, colors: x?.colors ?? [], latencyMs: result.latencyMs });
      const descriptor = { category: x?.category ?? "other.other", subcategory: x?.subcategory ?? null, colors: x?.colors ?? [], brand: x?.brand ?? null, material: x?.material ?? null, features: x?.features ?? [] };
      const { data } = await supabase
        .from("found_items")
        .insert({
          facility_id: facility.id,
          ...descriptor,
          public_summary: x?.public_summary || item.key,
          private_features: x?.private_features ?? [],
          is_sensitive: x?.is_sensitive ?? false,
          search_text: buildSearchText(descriptor, x?.private_features ?? []),
          found_at: item.found_at,
          found_area: item.found_area,
          ai_status: x ? "done" : "failed",
          ai_confidence: x?.confidence ?? null,
          ai_latency_ms: result.latencyMs,
        })
        .select("id")
        .single();
      if (data) itemIds.set(item.key, data.id);
    }

    const keyOfItem = new Map([...itemIds].map(([k, id]) => [id, k]));
    const reportIds = new Map<string, string>();
    for (const r of cases.reports) {
      const { data } = await supabase
        .from("lost_reports")
        .insert({
          facility_id: facility.id,
          description: r.description,
          secret_detail: r.secret_detail ?? null,
          user_category: r.user_category ?? null,
          lost_from: r.lost_from,
          lost_to: r.lost_to,
          lost_area: r.lost_area,
          contact_email: `${r.key.toLowerCase()}@example.invalid`,
          consent_at: new Date().toISOString(),
          access_token: `eval${crypto.randomUUID().replaceAll("-", "")}`.slice(0, 32),
          created_via: "admin",
        })
        .select("id")
        .single();
      if (!data) continue;
      reportIds.set(r.key, data.id);
      await processReport(data.id);
    }

    const firstAi = await aiValues(facility.id);
    const outcomes: ReportOutcome[] = [];
    for (const r of cases.reports) {
      const id = reportIds.get(r.key);
      if (!id) continue;
      const { data } = await supabase.from("match_candidates").select("found_item_id, score").eq("lost_report_id", id).order("score", { ascending: false });
      outcomes.push({
        key: r.key,
        split: r.split,
        expected: r.expected_item,
        blurry: r.description.trim() === "",
        ranked: (data ?? []).map((c) => ({ item: keyOfItem.get(c.found_item_id) ?? c.found_item_id, score: Number(c.score) })),
      });
    }

    // 판정 안정성: judge every report once more and compare the AI similarity per pair.
    for (const id of reportIds.values()) await matchForReport(id, defaultMatchDeps());
    const stable = stability(firstAi, await aiValues(facility.id));

    const report = render(day, cases.items.length, outcomes, extractionSummary(extraction), stable, tokens);
    mkdirSync(join(ROOT, "eval/results"), { recursive: true });
    writeFileSync(join(ROOT, `eval/results/${day}.md`), report);
    console.info(report);
  } finally {
    if (process.env.EVAL_KEEP !== "1") await supabase.from("facilities").delete().eq("id", facility.id);
  }

  async function aiValues(facilityId: string): Promise<Map<string, number>> {
    const { data } = await supabase.from("match_candidates").select("lost_report_id, found_item_id, breakdown").eq("facility_id", facilityId);
    return new Map(
      (data ?? []).flatMap((c) => {
        const ai = (c.breakdown as { ai?: unknown; judged?: unknown } | null) ?? {};
        return typeof ai.ai === "number" && ai.judged !== false ? [[`${c.lost_report_id}:${c.found_item_id}`, ai.ai] as const] : [];
      }),
    );
  }
});

function totalTokens(usage: unknown): number {
  const n = (usage as { totalTokenCount?: unknown } | null)?.totalTokenCount;
  return typeof n === "number" ? n : 0;
}

function render(day: string, items: number, outcomes: ReportOutcome[], extraction: ReturnType<typeof extractionSummary>, stable: ReturnType<typeof stability>, tokens: number): string {
  const row = (split: Split) => {
    const s = summarize(outcomes.filter((o) => o.split === split), DEFAULT_MATCH_CONFIG.notifyThreshold);
    return `| ${split} | ${s.reports} | ${pct(s.top1)} | ${pct(s.top3)} | ${s.mrr === null ? "—" : s.mrr.toFixed(3)} | ${pct(s.blurry.top3)} (${s.blurry.n}) | ${pct(s.decoys.falseAlertRate)} (${s.decoys.n}) | ${pct(s.wrongTop1Alert)} |`;
  };
  return [
    `# 매칭 평가 ${day}`,
    "",
    `습득물 ${items}개, 신고 ${outcomes.length}건. 가중치·임계값은 dev만 보고 고친다 (docs/05 §7-5).`,
    "",
    "| split | 신고 | Top-1 | Top-3 (목표 90%) | MRR | 흐린 신고 Top-3 (목표 70%) | 오알림률 (목표 10% 이하) | 잘못된 1위 알림 |",
    "|---|---|---|---|---|---|---|---|",
    row("dev"),
    row("test"),
    "",
    "| 사진 분석 | 값 |",
    "|---|---|",
    `| 분류 정확도 (목표 90%) | ${pct(extraction.category)} (${extraction.n}) |`,
    `| 색상 정확도 | ${pct(extraction.color)} |`,
    `| 지연 p50 / p95 (목표 p95 8초) | ${extraction.p50Ms ?? "—"} ms / ${extraction.p95Ms ?? "—"} ms |`,
    `| 판정 안정성 (목표 90%) | ${pct(stable.rate)} (${stable.n}쌍) |`,
    `| 사진 분석 토큰 합계 | ${tokens} |`,
    "",
  ].join("\n");
}
