import { describe, expect, it } from "vitest";
import { formatWait, isLongWait } from "./wait";

const now = new Date("2026-11-25T12:00:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

describe("formatWait", () => {
  it("분·시간·일로 줄여 보여준다", () => {
    expect(formatWait(ago(20), now)).toBe("20분");
    expect(formatWait(ago(108), now)).toBe("1시간 48분");
    expect(formatWait(ago(240), now)).toBe("4시간");
    expect(formatWait(ago(60 * 26), now)).toBe("1일");
  });

  it("미래 시각은 0분", () => {
    expect(formatWait(ago(-5), now)).toBe("0분");
  });
});

describe("isLongWait", () => {
  it("하루가 넘으면 길게 기다린 것으로 본다", () => {
    expect(isLongWait(ago(60 * 24), now)).toBe(true);
    expect(isLongWait(ago(60 * 23), now)).toBe(false);
  });
});
