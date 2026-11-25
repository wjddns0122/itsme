import { describe, expect, it } from "vitest";
import { readAiEnv, tierAllowed } from "./client";

const base = { GEMINI_API_KEY: "test-key", VISION_MODEL: "v", LLM_MODEL: "l" };

describe("readAiEnv", () => {
  it("등급을 적지 않으면 무료 등급으로 본다", () => {
    expect(readAiEnv(base).GEMINI_TIER).toBe("free");
  });

  it("운영 배포에서는 무료 등급 키를 거부한다", () => {
    expect(() => readAiEnv({ ...base, VERCEL_ENV: "production" })).toThrow(/paid/);
    expect(() => readAiEnv({ ...base, VERCEL_ENV: "production", GEMINI_TIER: "free" })).toThrow();
    expect(readAiEnv({ ...base, VERCEL_ENV: "production", GEMINI_TIER: "paid" }).GEMINI_TIER).toBe("paid");
  });

  it("미리보기·개발 배포에서는 무료 등급도 쓸 수 있다", () => {
    expect(readAiEnv({ ...base, VERCEL_ENV: "preview" }).GEMINI_TIER).toBe("free");
  });
});

describe("tierAllowed (해커톤 시연 예외)", () => {
  const prod = { ...base, VERCEL_ENV: "production", GEMINI_FREE_DEMO_UNTIL: "2026-11-26" };

  it("운영에서도 시연 마지막 날(한국 시간)이 끝날 때까지는 무료 키를 쓴다", () => {
    expect(tierAllowed(prod, "free", new Date("2026-11-26T14:59:00Z"))).toBe(true); // 23:59 KST
    expect(readAiEnv(prod, new Date("2026-11-25T03:00:00Z")).GEMINI_TIER).toBe("free");
  });

  it("시연 날짜가 지나면 다시 막는다", () => {
    expect(tierAllowed(prod, "free", new Date("2026-11-26T15:00:00Z"))).toBe(false); // 다음 날 00:00 KST
    expect(() => readAiEnv(prod, new Date("2026-11-27T01:00:00Z"))).toThrow(/paid/);
  });

  it("날짜가 없거나 잘못되면 막는다", () => {
    expect(tierAllowed({ ...prod, GEMINI_FREE_DEMO_UNTIL: "" }, "free")).toBe(false);
    expect(tierAllowed({ ...prod, GEMINI_FREE_DEMO_UNTIL: "내일" }, "free")).toBe(false);
  });

  it("유료 키나 운영이 아닌 곳은 날짜와 상관없다", () => {
    expect(tierAllowed({ ...prod, GEMINI_FREE_DEMO_UNTIL: "" }, "paid")).toBe(true);
    expect(tierAllowed({ ...base, VERCEL_ENV: "preview" }, "free")).toBe(true);
  });
});
