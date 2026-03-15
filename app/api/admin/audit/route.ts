import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../src/auth";
import { getAuditLog, countAuditLog } from "../../../../src/audit-log";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  const entries = await getAuditLog(offset, Math.min(limit, 200));
  const total = await countAuditLog();

  return NextResponse.json({ entries, total, offset, limit });
}
