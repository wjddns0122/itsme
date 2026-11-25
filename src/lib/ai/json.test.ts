import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { z } from "zod";
import { readAiEnv } from "./client";
import { generateJson, interpretResponse, type JsonClient } from "./json";

const Schema = z.object({ category: z.string(), colors: z.array(z.string()) });

const reply = (text: string | undefined, finishReason = "STOP") =>
  ({
    text,
    candidates: [{ finishReason }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
  }) as unknown as GenerateContentResponse;

const fakeClient = (...responses: Array<GenerateContentResponse | Error>) => {
  const calls: GenerateContentParameters[] = [];
  const client: JsonClient = {
    models: {
      generateContent: vi.fn(async (params: GenerateContentParameters) => {
        calls.push(params);
        const next = responses.shift();
        if (!next || next instanceof Error) throw next ?? new Error("no more responses");
        return next;
      }),
    },
  };
  return { client, calls };
};

const PROMPT = "검은색 무선 이어폰, 연락처 010-1234-5678";

const run = (client: JsonClient) =>
  generateJson({ client, kind: "normalize", model: "test-model", schema: Schema, contents: PROMPT });

let logSpy: MockInstance<typeof console.info>;
beforeEach(() => {
  logSpy = vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
  logSpy.mockRestore();
});

describe("interpretResponse", () => {
  it("accepts finished JSON that matches the schema", () => {
    expect(interpretResponse(reply('{"category":"x","colors":[]}'), Schema)).toEqual({
      ok: true,
      data: { category: "x", colors: [] },
    });
  });

  it("rejects responses that did not finish normally", () => {
    expect(interpretResponse(reply('{"category":"x","colors":[]}', "SAFETY"), Schema)).toEqual({ ok: false, error: "not_finished" });
    expect(interpretResponse(reply('{"category":"x"', "MAX_TOKENS"), Schema)).toEqual({ ok: false, error: "not_finished" });
  });

  it("rejects empty text, broken JSON and schema mismatches", () => {
    expect(interpretResponse(reply(undefined), Schema)).toEqual({ ok: false, error: "empty_response" });
    expect(interpretResponse(reply("not json"), Schema)).toEqual({ ok: false, error: "invalid_json" });
    expect(interpretResponse(reply('{"category":1}'), Schema)).toEqual({ ok: false, error: "schema_mismatch" });
  });
});

describe("generateJson", () => {
  it("asks for JSON with a schema and never sends sampling parameters", async () => {
    const { client, calls } = fakeClient(reply('{"category":"electronics.earphones","colors":["검정"]}'));
    const result = await run(client);

    expect(result).toEqual({
      ok: true,
      data: { category: "electronics.earphones", colors: ["검정"] },
      attempts: 1,
      usage: { promptTokenCount: 10, candidatesTokenCount: 5 },
    });
    const config = calls[0].config ?? {};
    expect(config.responseMimeType).toBe("application/json");
    expect(config.responseJsonSchema).toMatchObject({ type: "object" });
    expect(config).not.toHaveProperty("temperature");
    expect(config).not.toHaveProperty("topP");
    expect(config).not.toHaveProperty("topK");
  });

  it("retries once and succeeds on the second answer", async () => {
    const { client } = fakeClient(reply("oops"), reply('{"category":"x","colors":[]}'));
    expect(await run(client)).toMatchObject({ ok: true, data: { category: "x", colors: [] }, attempts: 2 });
  });

  it("gives up after one retry with the last error", async () => {
    const { client } = fakeClient(reply("oops"), reply('{"category":1}'));
    expect(await run(client)).toEqual({ ok: false, error: "schema_mismatch", attempts: 2 });
  });

  it("treats thrown requests as request_failed", async () => {
    const { client } = fakeClient(new Error("network"), new Error("network"));
    expect(await run(client)).toEqual({ ok: false, error: "request_failed", attempts: 2 });
  });

  it("logs model, latency and usage but never the prompt", async () => {
    const { client } = fakeClient(reply('{"category":"x","colors":[]}'));
    await run(client);
    const logged = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).toContain('"event":"ai_call"');
    expect(logged).toContain('"model":"test-model"');
    expect(logged).toContain("promptTokenCount");
    expect(logged).not.toContain("010-1234-5678");
    expect(logged).not.toContain("이어폰");
  });
});

describe("readAiEnv", () => {
  it("requires the key and model names, and defaults to the free tier", () => {
    expect(() => readAiEnv({ VISION_MODEL: "m", LLM_MODEL: "m" })).toThrow();
    expect(readAiEnv({ GEMINI_API_KEY: "k", VISION_MODEL: "m", LLM_MODEL: "m" }).GEMINI_TIER).toBe("free");
  });

  it("rejects unknown tiers", () => {
    expect(() => readAiEnv({ GEMINI_API_KEY: "k", VISION_MODEL: "m", LLM_MODEL: "m", GEMINI_TIER: "pro" })).toThrow();
  });
});
