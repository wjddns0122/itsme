import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JsonClient } from "./json";
import type { LostReportNormalization } from "@/lib/validation/ai";
import { normalizeReport, postProcessNormalization } from "./normalize";

const answer: LostReportNormalization = {
  category: "electronics.earphones",
  subcategory: "무선 이어폰",
  colors: ["흰색"],
  brand: "Apple",
  material: null,
  features: ["케이스에 스티커"],
  confidence: 0.85,
  language: "ko",
};

function client(response: unknown) {
  const calls: GenerateContentParameters[] = [];
  const c: JsonClient = {
    models: {
      generateContent: vi.fn(async (params: GenerateContentParameters) => {
        calls.push(params);
        if (response instanceof Error) throw response;
        return response as GenerateContentResponse;
      }),
    },
  };
  return { c, calls };
}

const ok = (data: unknown) => ({ text: JSON.stringify(data), candidates: [{ finishReason: "STOP" }] });

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
});

describe("normalizeReport", () => {
  it("설명·추가 특징·고른 분류만 보내고, 글에 적힌 전화번호·이메일은 가린다", async () => {
    const { c, calls } = client(ok(answer));
    const result = await normalizeReport({
      client: c,
      model: "m",
      input: { description: "에어팟 잃어버렸어요 010-1234-5678 로 연락주세요", secretDetail: "케이스에 곰 스티커, me@example.com", userCategory: "sports" },
    });
    expect(result.ok).toBe(true);
    const sent = JSON.stringify(calls[0].contents);
    expect(sent).toContain("에어팟 잃어버렸어요");
    expect(sent).toContain("분실자가 고른 분류: sports (고글·헬멧)");
    expect(sent).not.toContain("010-1234-5678");
    expect(sent).not.toContain("me@example.com");
  });

  it("모르는 분류 코드는 보내지 않는다", async () => {
    const { c, calls } = client(ok(answer));
    await normalizeReport({ client: c, model: "m", input: { description: "지갑", secretDetail: null, userCategory: "drop table" } });
    expect(JSON.stringify(calls[0].contents)).not.toContain("분실자가 고른 분류");
  });

  it("재시도 후에도 실패하면 ok: false", async () => {
    const { c, calls } = client(new Error("down"));
    const result = await normalizeReport({ client: c, model: "m", input: { description: "지갑", secretDetail: null, userCategory: null } });
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(2);
  });
});

describe("postProcessNormalization", () => {
  it("빈 언어 코드는 ko로 둔다", () => {
    expect(postProcessNormalization({ ...answer, language: " " }).language).toBe("ko");
  });
});
