import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isLenderRoute = path.startsWith("/lender");
  const isBorrowerRoute = path.startsWith("/borrower");
  const isCeoRoute = path.startsWith("/ceo");
  const isDashboardRoute = path === "/dashboard";
  const isSupportRoute = path.startsWith("/customer-service");
  const isDirectoryRoute = path.startsWith("/directory");
  const isProtectedRoute = isLenderRoute || isBorrowerRoute || isCeoRoute || isDashboardRoute || isSupportRoute || isDirectoryRoute;

  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

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
    .select("role,roles")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return redirectWithCookies(new URL("/auth?error=profile", request.url));
  }

  const role = profile.role;
  const roles: string[] = Array.isArray(profile.roles) ? profile.roles : [role];
  const selectedPortal = request.nextUrl.searchParams.get("portal");
  const allowed =
    (isLenderRoute && roles.includes("lender")) ||
    (isBorrowerRoute && roles.includes("borrower")) ||
    (isDashboardRoute && (
      (selectedPortal === "lender" && roles.includes("lender")) ||
      (selectedPortal === "borrower" && roles.includes("borrower")) ||
      (!selectedPortal && (role === "lender" || role === "borrower") && roles.includes(role))
    )) ||
    (isSupportRoute && (roles.includes("lender") || roles.includes("borrower") || roles.includes("ceo"))) ||
    (isDirectoryRoute && (roles.includes("lender") || roles.includes("borrower"))) ||
    (isCeoRoute && roles.includes("ceo"));

  if (!allowed) return redirectWithCookies(new URL("/auth?error=role", request.url));

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
