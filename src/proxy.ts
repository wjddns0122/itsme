import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_HOME, ADMIN_LOGIN } from "@/lib/admin/routes";
import { readSupabaseEnv } from "@/lib/supabase/env";

/**
 * Admin pages only: refreshes the Supabase session cookie and sends signed-out
 * visitors to the login page. This is an optimistic check; pages still verify the
 * admin through lib/auth/admin.ts and RLS.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = readSupabaseEnv();

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Keep this call right after createServerClient: it is what refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, searchParams } = request.nextUrl;
  const onLogin = pathname === ADMIN_LOGIN;

  if (!signedIn && !onLogin) return redirectKeepingCookies(request, response, ADMIN_LOGIN);
  // A signed-in account without a facility is sent to the login page with ?error=, so let it stay.
  if (signedIn && onLogin && !searchParams.has("error")) return redirectKeepingCookies(request, response, ADMIN_HOME);
  return response;
}

// Carries refreshed auth cookies and their no-store cache headers onto the redirect.
const NO_STORE_HEADERS = ["cache-control", "expires", "pragma"];

function redirectKeepingCookies(request: NextRequest, from: NextResponse, path: string) {
  const redirect = NextResponse.redirect(new URL(path, request.url));
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  for (const name of NO_STORE_HEADERS) {
    const value = from.headers.get(name);
    if (value) redirect.headers.set(name, value);
  }
  return redirect;
}

export const config = {
  matcher: ["/admin/:path*"],
};
