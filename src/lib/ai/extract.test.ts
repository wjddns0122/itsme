import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractFoundItem } from "./extract";
import type { JsonClient } from "./json";

const answer = {
  category: "wallet_card.id",
  subcategory: "학생증",
  colors: ["흰색"],
  brand: null,
  material: null,
  features: ["카드형"],
  confidence: 0.8,
  public_summary: "학생증 (이름 가림) 20261234",
  private_features: ["뒷면 스티커"],
  is_sensitive: false,
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

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
});

describe("extractFoundItem", () => {
  it("사진과 시설 정보를 보내고, 후처리한 결과를 돌려준다", async () => {
    const { c, calls } = client({
      text: JSON.stringify(answer),
      candidates: [{ finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 1200 },
    });
    const result = await extractFoundItem({ client: c, model: "m", photos: [{ mimeType: "image/jpeg", base64: "AAA" }], facilityType: "school", foundArea: null });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.extraction.is_sensitive).toBe(true); // forced for IDs
    expect(result.extraction.public_summary).toBe("학생증 (이름 가림) ***"); // masked
    expect(result.raw).toMatchObject({ prompt: "photo-extract-v1", usage: { promptTokenCount: 1200 } });

    const parts = (calls[0].contents as { parts: Array<Record<string, unknown>> }[])[0].parts;
    expect(parts[0]).toEqual({ inlineData: { mimeType: "image/jpeg", data: "AAA" } });
    expect(parts[1]).toEqual({ text: "시설 종류: school / 습득 구역: 미입력" });
  });

  it("실패하면 ok: false (수동 입력으로 넘어간다)", async () => {
    const { c } = client(new Error("network"));
    const result = await extractFoundItem({ client: c, model: "m", photos: [], facilityType: "school", foundArea: "도서관" });
    expect(result.ok).toBe(false);
  });
});
