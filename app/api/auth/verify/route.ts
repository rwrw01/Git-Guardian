import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHmac } from "node:crypto";
import { verifyMagicToken, createSession } from "../../../../src/auth";
import { logAudit } from "../../../../src/audit-log";
import { getRedis } from "../../../../src/redis";

export const runtime = "nodejs";

const USED_TOKEN_PREFIX = "used-magic-token:";

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing-token", request.url));
  }

  // Check if token was already used (one-time use)
  const redis = getRedis();
  const tokenHash = createHmac("sha256", "token-dedup").update(token).digest("hex").slice(0, 32);
  const alreadyUsed = await redis.get(`${USED_TOKEN_PREFIX}${tokenHash}`);

  if (alreadyUsed) {
    return NextResponse.redirect(new URL("/login?error=token-used", request.url));
  }

  const result = verifyMagicToken(token);

  if (!result.valid) {
    return NextResponse.redirect(new URL("/login?error=invalid-token", request.url));
  }

  // Mark token as used (expire after 15 min — longer than token TTL for safety)
  await redis.set(`${USED_TOKEN_PREFIX}${tokenHash}`, 1, { ex: 900 });

  await createSession(result.email);
  await logAudit(result.email, "LOGIN", result.email, "Magic link login successful");

  return NextResponse.redirect(new URL("/admin", request.url));
}
