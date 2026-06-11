import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired (also keeps cookies fresh on /api/* tabs).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // API routes own their own auth (API keys, webhooks, cron secrets, etc.).
  // Middleware only refreshes the session cookie for them — no redirect logic.
  if (path.startsWith("/api/")) {
    return supabaseResponse;
  }

  // Page routes are deny-by-default: anything not in this allowlist requires
  // an authenticated user. Adding a new page now defaults to "logged-in only".
  const PUBLIC_PAGE_PATHS = [
    "/login",
    "/signup",
    "/agent-for-x", // privacy, terms, marketing legal
    "/.well-known", // OAuth AS / protected-resource metadata (MCP connector)
  ];

  const isPublicPath = PUBLIC_PAGE_PATHS.some(
    (p) => path === p || path.startsWith(p + "/")
  );

  if (!isPublicPath && !user) {
    const url = request.nextUrl.clone();
    // Carry the destination (path + query) so login can return the user —
    // the OAuth consent page (/oauth/authorize?...) depends on this.
    const next = request.nextUrl.pathname + request.nextUrl.search;
    url.pathname = "/login";
    url.search = "";
    if (next !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users away from auth pages (honoring a safe next=)
  const authPaths = ["/login", "/signup"];
  if (authPaths.includes(path) && user) {
    const url = request.nextUrl.clone();
    const nextParam = request.nextUrl.searchParams.get("next") ?? "/";
    const safeNext =
      nextParam.startsWith("/") && !nextParam.startsWith("//") && !nextParam.includes("://")
        ? nextParam
        : "/";
    url.pathname = safeNext.split("?")[0];
    url.search = safeNext.includes("?") ? safeNext.slice(safeNext.indexOf("?")) : "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     *
     * /api/* IS matched so getUser() refreshes the Supabase session cookie,
     * but middleware does not enforce auth on API routes.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
