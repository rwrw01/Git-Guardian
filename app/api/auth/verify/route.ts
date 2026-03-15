import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyMagicToken, createSession } from "../../../../src/auth";
import { logAudit } from "../../../../src/audit-log";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing-token", request.url));
  }

  const result = verifyMagicToken(token);

  if (!result.valid) {
    return NextResponse.redirect(new URL("/login?error=invalid-token", request.url));
  }

  await createSession(result.email);
  await logAudit(result.email, "LOGIN", result.email, "Magic link login successful");

  return NextResponse.redirect(new URL("/admin", request.url));
}
