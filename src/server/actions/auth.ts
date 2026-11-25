"use server";

import { redirect } from "next/navigation";
import { ADMIN_HOME, ADMIN_LOGIN } from "@/lib/admin/routes";
import { createClient } from "@/lib/supabase/server";
import { SignInSchema } from "@/lib/validation/auth";
import type { ErrorCode } from "./result";

/**
 * null until the first submit. Success redirects, so only failures come back.
 * `email` refills the field after React resets the form; the password never comes back.
 */
export type SignInState = { ok: false; error: ErrorCode; email: string } | null;

// A-01 로그인. Never log the email or password.
export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const raw = { email: formData.get("email"), password: formData.get("password") };
  const typedEmail = typeof raw.email === "string" ? raw.email : "";
  const parsed = SignInSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input", email: typedEmail };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: signInErrorCode(error.status, error.code), email: parsed.data.email };

  redirect(ADMIN_HOME);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  // "local" clears this browser's cookies first, so a shared front-desk PC is signed out
  // even when the Auth server is unreachable.
  await supabase.auth.signOut({ scope: "local" });
  redirect(ADMIN_LOGIN);
}

function signInErrorCode(status: number | undefined, code: string | undefined): ErrorCode {
  if (status === 429) return "rate_limited";
  if (code === "invalid_credentials" || code === "email_not_confirmed" || status === 400) return "unauthorized";
  return "internal";
}
