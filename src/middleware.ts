import { NextResponse, type NextRequest } from "next/server";

// Cheap gate: presence of the session cookie only. Full validation happens in
// the protected server components via getCurrentUser(). Keep the cookie name in
// sync with SESSION_COOKIE in .env (default "sid").
const SESSION_COOKIE = "sid";

export function middleware(req: NextRequest) {
  const sid = req.cookies.get(SESSION_COOKIE)?.value;
  if (sid) return NextResponse.next();

  const url = new URL("/login", req.url);
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
