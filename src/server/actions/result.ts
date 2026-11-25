// Shared Server Action result shape (.claude/rules/server-actions.md).
export type ErrorCode =
  | "invalid_input"
  | "unauthorized"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "ai_failed"
  | "internal";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ErrorCode };
