import { NextRequest, NextResponse } from "next/server";
import { canAccessPage, canAccessApi, getUserRole } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow login page, auth API, and static assets
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("auth_token")?.value;
  const username = request.cookies.get("auth_user")?.value;

  // No token → redirect to login (or 401 for API)
  if (!token || !username) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Validate token structure
  try {
    const decoded = Buffer.from(token, "base64").toString();
    const parts = decoded.split(":");
    if (parts.length < 3) throw new Error("Invalid token");
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.set("auth_token", "", { path: "/", maxAge: 0 });
    res.cookies.set("auth_user", "", { path: "/", maxAge: 0 });
    return res;
  }

  // Check role-based access
  if (pathname.startsWith("/api/")) {
    if (!canAccessApi(username, pathname)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    // Page route — check access
    if (!canAccessPage(username, pathname)) {
      // Redirect to user's default page
      const role = getUserRole(username);
      const defaultPage = role?.default || "/login";
      return NextResponse.redirect(new URL(defaultPage, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
