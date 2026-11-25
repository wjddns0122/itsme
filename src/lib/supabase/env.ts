import { z } from "zod";

// Public values: safe in the browser and in proxy. The service role key lives in admin.ts only.
const PublicEnvSchema = z.object({
  url: z.url("NEXT_PUBLIC_SUPABASE_URL is not set"),
  anonKey: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set"),
});

export type SupabasePublicEnv = z.infer<typeof PublicEnvSchema>;

export function readSupabaseEnv(): SupabasePublicEnv {
  // Literal property access so Next can inline NEXT_PUBLIC_ values.
  return PublicEnvSchema.parse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
