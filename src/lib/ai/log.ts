import "server-only";

export type AiKind = "extract" | "normalize" | "judge" | "verify" | "report_photo";

export type AiCallLog = {
  kind: AiKind;
  model: string;
  attempt: number;
  latency_ms: number;
  ok: boolean;
  finish_reason?: string;
  error?: string;
  /** HTTP status of a failed request (429 quota, 404 unknown model …). Never the message body. */
  http_status?: number;
  /** Token counts only. Never pass prompts, contact data or tokens here. */
  usage?: unknown;
};

export function logAiCall(entry: AiCallLog): void {
  console.info(JSON.stringify({ event: "ai_call", ...entry }));
}
