import { describe, expect, it } from "vitest";
import { groupReports } from "./group";

const row = (id: string, contactKey: string | null, contactName: string | null = null) => ({ id, contactKey, contactName, createdAt: `2026-11-2${id}` });

describe("groupReports", () => {
  it("같은 연락처의 신고를 처음 나온 자리에 한 묶음으로 모은다", () => {
    const totals = new Map([["0101", { count: 3, latest: "2026-11-25" }]]);
    const groups = groupReports([row("1", "0101", "김민지"), row("2", "0202"), row("3", "0101")], totals);
    expect(groups.map((g) => [g.key, g.rows.map((r) => r.id)])).toEqual([
      ["0101", ["1", "3"]],
      [null, ["2"]],
    ]);
    expect(groups[0]).toMatchObject({ name: "김민지", total: 3, latest: "2026-11-25" });
  });

  it("신고가 한 건뿐인 사람과 연락처 키가 없는 신고는 묶지 않는다", () => {
    const totals = new Map([["0101", { count: 1, latest: "2026-11-25" }]]);
    const groups = groupReports([row("1", "0101"), row("2", null)], totals);
    expect(groups.every((g) => g.key === null && g.rows.length === 1)).toBe(true);
  });

  it("이름은 묶음 안에서 처음 나온 이름을 쓴다", () => {
    const totals = new Map([["0101", { count: 2, latest: "2026-11-25" }]]);
    expect(groupReports([row("1", "0101"), row("2", "0101", "이하늘")], totals)[0].name).toBe("이하늘");
  });
});
