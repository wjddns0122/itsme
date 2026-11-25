import { describe, expect, it } from "vitest";
import { candidatePhotoPaths, reportPhase, showInfoLow, toReportView, type CandidateRow, type FacilityPickupRow, type ReportRow } from "./view";

const report: ReportRow = {
  description: "주황 미러 렌즈 고글",
  user_category: "sports",
  lost_from: "2026-11-24",
  lost_to: "2026-11-24",
  lost_area: "리프트 A",
  lost_time_of_day: "afternoon",
  is_rental: false,
  status: "open",
  created_at: "2026-11-25T01:00:00Z",
  ai_status: "done",
};

const facility: FacilityPickupRow = {
  name: "평창 ○○ 스키장 (예시)",
  slug: "pc-ski",
  desk_location: "스키하우스 1층",
  hours: "매일",
  contact_phone: "033-000-0000",
  pickup_guide: "신분증",
};

const item = {
  category: "sports.goggles",
  subcategory: null,
  public_summary: "검은 테 고글, 주황 미러 렌즈",
  found_at: "2026-11-24T16:30:00Z",
  found_area: "리프트 A",
  is_sensitive: false,
  photo_paths: [] as string[],
  facility_id: "",
  ai_status: "done" as const,
  review_needed: false,
};

const FAC = "11111111-1111-4111-8111-111111111111";
const OTHER_FAC = "22222222-2222-4222-8222-222222222222";
const P1 = `${FAC}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg`;
const P2 = `${FAC}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg`;
item.facility_id = FAC;
item.photo_paths = [P1, P2];
// Real Supabase signed URLs carry the object path (ADR-030).
const signed = (path: string) => `https://proj.supabase.co/storage/v1/object/sign/found-items/${path}?token=t`;

// Rows as they might come back from the database, with private columns attached on purpose.
const candidate = (over: Partial<CandidateRow> & Record<string, unknown> = {}): CandidateRow =>
  ({
    id: "c1",
    status: "suggested",
    score: 0.82,
    coverage: 0.9,
    pickup_message: "내일 오전에 오세요",
    proof_request: "케이스 사진을 보내 주세요",
    item: { ...item, private_features: ["끈 안쪽 M.K"] },
    ai_verdict: { match: true },
    review_note: "관리자 메모",
    breakdown: { ai: 0.9 },
    contact_key: "01012345678",
    ...over,
  }) as CandidateRow;

describe("toReportView: §9-2 허용 필드만", () => {
  it("비공개 특징, 사진 경로, 점수, 충족도 숫자, AI 비교 결과, 관리자 메모, 연락처 키가 없다", () => {
    const view = toReportView(report, facility, [candidate()]);
    const json = JSON.stringify(view);
    for (const banned of ["private_features", "photo_paths", "M.K", P1, "score", "0.82", "coverage", "ai_verdict", "review_note", "관리자 메모", "breakdown", "contact_key", "01012345678"]) {
      expect(json).not.toContain(banned);
    }
  });

  it("유사도는 높음/보통 라벨로만", () => {
    const view = toReportView(report, facility, [candidate({ id: "a", score: 0.7 }), candidate({ id: "b", score: 0.5 })]);
    expect(view.candidates.map((c) => c.similarity)).toEqual(["high", "medium"]);
  });

  it("민감 물품은 분류만 보여주고, 서명 URL이 있어도 사진을 넣지 않는다", () => {
    const view = toReportView(report, facility, [candidate({ item: { ...item, category: "wallet_card.card", is_sensitive: true } })], new Map([[P1, signed(P1)]]));
    expect(view.candidates[0].item).toEqual({ category: "카드·교통카드", categoryCode: "wallet_card.card", summary: null, foundDate: null, foundArea: null, photoUrl: null });
    expect(JSON.stringify(view)).not.toContain(P1);
  });

  it("사진은 첫 장의 서명 URL 하나만 담고, 사진 경로 필드나 다른 사진은 담지 않는다", () => {
    const view = toReportView(report, facility, [candidate()], new Map([[P1, signed(P1)], [P2, signed(P2)]]));
    expect(view.candidates[0].item.photoUrl).toBe(signed(P1));
    const json = JSON.stringify(view);
    for (const banned of ["photo_paths", P2]) expect(json).not.toContain(banned);
  });

  it("서명에 실패했거나 사진이 없으면 사진 없이 보여준다", () => {
    expect(toReportView(report, facility, [candidate()]).candidates[0].item.photoUrl).toBeNull();
    const noPhoto = candidate({ item: { ...item, photo_paths: [] } });
    expect(toReportView(report, facility, [noPhoto], new Map([[P1, signed(P1)]])).candidates[0].item.photoUrl).toBeNull();
  });

  it("지갑·서류, AI 확인 전, 검토가 필요한 물건은 서명 URL이 있어도 사진을 넣지 않는다", () => {
    const urls = new Map([[P1, signed(P1)]]);
    for (const over of [{ category: "wallet_card.wallet" }, { category: "document.document" }, { ai_status: "failed" as const }, { review_needed: true }]) {
      expect(toReportView(report, facility, [candidate({ item: { ...item, ...over } })], urls).candidates[0].item.photoUrl).toBeNull();
    }
  });

  it("거절된 요청은 목록에서 빼고, 사유 없이 '확인되지 않았어요'만 알린다", () => {
    const view = toReportView(report, facility, [candidate({ status: "rejected", review_note: "특징 불일치" }), candidate({ id: "c2" })]);
    expect(view.notConfirmed).toBe(true);
    expect(view.candidates.every((c) => c.status !== ("rejected" as string))).toBe(true);
    expect(JSON.stringify(view)).not.toContain("특징 불일치");
  });

  it("수령 안내는 승인됐을 때만, 추가 증빙 요청은 요청 상태일 때만", () => {
    const [suggested] = toReportView(report, facility, [candidate()]).candidates;
    expect(suggested.pickupMessage).toBeNull();
    expect(suggested.proofRequest).toBeNull();
    const [approved] = toReportView(report, facility, [candidate({ status: "approved" })]).candidates;
    expect(approved.pickupMessage).toBe("내일 오전에 오세요");
    const [proof] = toReportView(report, facility, [candidate({ status: "needs_proof" })]).candidates;
    expect(proof.proofRequest).toBe("케이스 사진을 보내 주세요");
  });

  it("거절·숨긴 후보는 빼고, 점수 높은 순으로 최대 5개", () => {
    const rows = [
      candidate({ id: "x", status: "rejected" }),
      candidate({ id: "y", status: "dismissed" }),
      ...[0.5, 0.9, 0.6, 0.7, 0.8, 0.55].map((s, i) => candidate({ id: `c${i}`, score: s })),
    ];
    const ids = toReportView(report, facility, rows).candidates.map((c) => c.id);
    expect(ids).toEqual(["c1", "c4", "c3", "c2", "c5"]);
  });

  it("습득일은 한국 날짜로 (UTC 16:30 = 다음 날)", () => {
    expect(toReportView(report, facility, [candidate()]).candidates[0].item.foundDate).toBe("2026-11-25");
  });
});

describe("candidatePhotoPaths", () => {
  const path = (n: number, fac = FAC) => `${fac}/${String(n).repeat(8)}-0000-4000-8000-000000000000.jpg`;

  it("화면에 나오는 상위 5개 후보의 첫 사진만, 민감 물품·숨긴 후보·사진 없는 후보는 뺀다", () => {
    const rows = [
      candidate({ id: "hidden", status: "dismissed", item: { ...item, photo_paths: [path(9)] } }),
      candidate({ id: "card", score: 0.95, item: { ...item, is_sensitive: true, photo_paths: [path(8)] } }),
      candidate({ id: "none", score: 0.9, item: { ...item, photo_paths: [] } }),
      ...[0.8, 0.7, 0.6, 0.5].map((s, i) => candidate({ id: `c${i}`, score: s, item: { ...item, photo_paths: [path(i), path(i + 4)] } })),
    ];
    expect(candidatePhotoPaths(rows, FAC)).toEqual([path(0), path(1), path(2)]);
  });

  it("신고한 시설의 습득물이고 경로도 그 시설 폴더일 때만 서명한다", () => {
    const rows = [
      candidate({ id: "ok", score: 0.9, item: { ...item, photo_paths: [path(1)] } }),
      candidate({ id: "other-item", score: 0.8, item: { ...item, facility_id: OTHER_FAC, photo_paths: [path(2, OTHER_FAC)] } }),
      candidate({ id: "other-path", score: 0.7, item: { ...item, photo_paths: [path(3, OTHER_FAC)] } }),
      candidate({ id: "bad-path", score: 0.6, item: { ...item, photo_paths: ["../etc/passwd"] } }),
    ];
    expect(candidatePhotoPaths(rows, FAC)).toEqual([path(1)]);
  });

  it("지갑·서류, AI 확인 전, 검토가 필요한 물건은 서명하지 않는다", () => {
    const rows = [{ category: "wallet_card.wallet" }, { category: "document.document" }, { ai_status: "pending" as const }, { review_needed: true }].map((over, i) =>
      candidate({ id: `x${i}`, item: { ...item, ...over, photo_paths: [path(i)] } }),
    );
    expect(candidatePhotoPaths(rows, FAC)).toEqual([]);
  });
});

describe("reportPhase", () => {
  const view = (rows: CandidateRow[], over: Partial<ReportRow> = {}) => toReportView({ ...report, ...over }, facility, rows);

  it("상태별 화면을 고른다", () => {
    expect(reportPhase(view([], { ai_status: "pending" }))).toBe("analyzing");
    expect(reportPhase(view([]))).toBe("empty");
    expect(reportPhase(view([candidate()]))).toBe("candidates");
    expect(reportPhase(view([candidate({ status: "claimed" })]))).toBe("claimed");
    expect(reportPhase(view([candidate({ status: "needs_proof" })]))).toBe("needs_proof");
    expect(reportPhase(view([candidate({ status: "approved" })]))).toBe("approved");
    expect(reportPhase(view([candidate()], { status: "closed" }))).toBe("closed");
  });

  it("모든 후보의 정보가 적을 때만 정보 부족 안내", () => {
    expect(showInfoLow(view([candidate({ coverage: 0.5 }), candidate({ id: "b", coverage: 0.4 })]))).toBe(true);
    expect(showInfoLow(view([candidate({ coverage: 0.5 }), candidate({ id: "b", coverage: 0.9 })]))).toBe(false);
    expect(showInfoLow(view([]))).toBe(false);
  });
});
