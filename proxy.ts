import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (request.nextUrl.pathname !== "/account-deletion") {
    const { data: profile } = await supabase.from("profiles").select("deletion_requested_at").eq("user_id", user.id).maybeSingle();
    if (profile?.deletion_requested_at) return NextResponse.redirect(new URL("/account-deletion", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/profile/:path*",
    "/meal-plans/:path*",
    "/log/:path*",
    "/history/:path*",
    "/photo/:path*",
    "/suggestions/:path*",
    "/weekly-plan/:path*",
    "/onboarding/:path*",
    "/admin/:path*",
    "/account-deletion",
  ],
};
