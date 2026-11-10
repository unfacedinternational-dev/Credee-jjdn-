import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PRIVATE_PREFIXES = ["/lender", "/borrower", "/ceo"];

function copyAuthCookies(source: NextResponse, destination: NextResponse) {
  destination.cookies.setAll(source.cookies.getAll());
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(header);
    if (value) destination.headers.set(header, value);
  }
  return destination;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const isPrivateRoute = PRIVATE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Fail closed for private routes if Supabase is not configured.
  if (!supabaseUrl || !supabaseKey) {
    if (isPrivateRoute) {
      return NextResponse.redirect(new URL("/auth", request.url));
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

  // Verify the token and refresh it when needed. Do not trust getSession()
  // for authorization because it reads the cookie without validating it.
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const isAuthenticated = !claimsError && Boolean(claimsData?.claims?.sub);

  if (isPrivateRoute && !isAuthenticated) {
    return copyAuthCookies(response, NextResponse.redirect(new URL("/auth", request.url)));
  }

  if (!isAuthenticated) return response;

  const userId = claimsData!.claims.sub as string;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  // Fail closed if the role cannot be confirmed.
  if (isPrivateRoute && (profileError || !profile?.role)) {
    return copyAuthCookies(response, NextResponse.redirect(new URL("/auth?error=profile", request.url)));
  }

  const role = profile?.role as string | undefined;
  let destination: string | null = null;

  if (pathname.startsWith("/ceo") && role !== "ceo") {
    destination = role === "lender" ? "/lender/dashboard" : role === "borrower" ? "/borrower/portal" : "/auth";
  } else if (pathname.startsWith("/lender") && role !== "lender" && role !== "ceo") {
    destination = role === "borrower" ? "/borrower/portal" : "/auth";
  } else if (pathname.startsWith("/borrower") && role !== "borrower" && role !== "ceo") {
    destination = role === "lender" ? "/lender/dashboard" : "/auth";
  }

  if (destination) {
    return copyAuthCookies(response, NextResponse.redirect(new URL(destination, request.url)));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
