import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../src/auth";
import {
  listFalsePositives,
  markFalsePositive,
  unmarkFalsePositive,
  type FalsePositive,
} from "../../../../src/scan-store";
import { logAudit } from "../../../../src/audit-log";

export const runtime = "nodejs";

export async function GET() {
  await requireAdmin();

  const fps = await listFalsePositives();
  return NextResponse.json({ falsePositives: fps, count: fps.length });
}

export async function POST(request: NextRequest) {
  const actor = await requireAdmin();

  const body = await request.json().catch(() => null);
  if (!body?.findingHash || !body?.repo || !body?.file || !body?.reason) {
    return NextResponse.json(
      { error: "findingHash, repo, file, and reason are required" },
      { status: 400 },
    );
  }

  const fp: FalsePositive = {
    findingHash: body.findingHash,
    repo: body.repo,
    file: body.file,
    pattern: body.pattern ?? "",
    markedBy: actor,
    markedAt: new Date().toISOString(),
    reason: body.reason,
  };

  await markFalsePositive(fp);
  await logAudit(actor, "FP_MARK", `${body.repo}:${body.file}`, `Marked false positive: ${body.reason}`);

  return NextResponse.json({ falsePositive: fp }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const actor = await requireAdmin();

  const body = await request.json().catch(() => null);
  if (!body?.findingHash) {
    return NextResponse.json({ error: "findingHash is required" }, { status: 400 });
  }

  await unmarkFalsePositive(body.findingHash);
  await logAudit(actor, "FP_UNMARK", body.findingHash, "Removed false positive marker");

  return NextResponse.json({ removed: true });
}
