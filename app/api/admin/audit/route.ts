import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "../../../../src/auth";
import { getAuditLog, countAuditLog } from "../../../../src/audit-log";

export const runtime = "nodejs";

async function getSession(request: NextRequest) {
  // @ts-expect-error — NextAuth v5 beta typing
  return auth(request);
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  const entries = await getAuditLog(offset, Math.min(limit, 200));
  const total = await countAuditLog();

  return NextResponse.json({ entries, total, offset, limit });
}
