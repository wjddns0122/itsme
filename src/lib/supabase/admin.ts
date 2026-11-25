import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { readSupabaseEnv } from "./env";
import type { Database } from "./types";

const ServiceKeySchema = z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is not set");

/**
 * Service role client. Bypasses RLS, so every query must limit its scope itself
 * (facility slug or access_token). Server only: docs/04-architecture.md §5-1.
 */
export function createAdminClient() {
  const { url } = readSupabaseEnv();
  const key = ServiceKeySchema.parse(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
