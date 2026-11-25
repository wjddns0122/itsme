import { describe, expect, it } from "vitest";
import { readAiEnv } from "./client";

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
