import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readSupabaseEnv } from "./env";
import type { Database } from "./types";

/**
 * Supabase client for the signed-in admin (RLS applies). Create one per request.
 * Reads cookies, so callers must render inside a <Suspense> boundary (cacheComponents).
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = readSupabaseEnv();

  return createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot write cookies. proxy.ts refreshes the session instead.
        }
      },
    },
  });
}
