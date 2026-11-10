import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isLenderRoute = path.startsWith("/lender");
  const isBorrowerRoute = path.startsWith("/borrower");
  const isCeoRoute = path.startsWith("/ceo");
  const isProtectedRoute = isLenderRoute || isBorrowerRoute || isCeoRoute;

  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Fail closed for private routes if Supabase is not configured.
  if (!supabaseUrl || !supabaseKey) {
    if (isProtectedRoute) {
      return NextResponse.redirect(new URL("/auth?error=configuration", request.url));
    }
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Validate the access token and allow Supabase to refresh the session.
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  function redirectWithCookies(destination: URL) {
    const redirectResponse = NextResponse.redirect(destination);
    // Preserve refreshed auth cookies so redirects do not lose the session.
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  if (error || typeof userId !== "string" || !userId) {
    if (isProtectedRoute) {
      return redirectWithCookies(new URL("/auth", request.url));
    }
    return response;
  }

  if (!isProtectedRoute) return response;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return redirectWithCookies(new URL("/auth?error=profile", request.url));
  }

  const role = profile.role;
  const allowed =
    (isLenderRoute && (role === "lender" || role === "ceo")) ||
    (isBorrowerRoute && (role === "borrower" || role === "ceo")) ||
    (isCeoRoute && role === "ceo");

  if (!allowed) {
    const destination =
      role === "lender"
        ? "/lender/dashboard"
        : role === "borrower"
          ? "/borrower/portal"
          : "/auth?error=role";

    return redirectWithCookies(new URL(destination, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
