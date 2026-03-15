import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// Edge-compatible session verification for admin routes.
// Duplicates minimal signature logic from src/auth.ts because middleware
// runs on the Edge runtime and cannot import Node.js-only next/headers.
// ---------------------------------------------------------------------------

function verifySessionCookie(value: string, secret: string): boolean {
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return false;

    const [email, expiresAtStr, signature] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);

    if (Math.floor(Date.now() / 1000) > expiresAt) return false;

    const payload = `${email}:${expiresAtStr}`;
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    const sigBuf = Buffer.from(signature, "utf-8");
    const expBuf = Buffer.from(expected, "utf-8");
    if (sigBuf.length !== expBuf.length) return false;
    if (!timingSafeEqual(sigBuf, expBuf)) return false;

    // Re-validate email against allowlist on every request
    const allowed = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (!allowed.includes(email)) return false;

    return true;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.redirect(new URL("/login?error=config", request.url));
  }

  const sessionCookie = request.cookies.get("gg_session")?.value;

  if (!sessionCookie || !verifySessionCookie(sessionCookie, secret)) {
    // API routes return 401, page routes redirect to login
    if (request.nextUrl.pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
