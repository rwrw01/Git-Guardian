import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "../../../../src/auth";
import {
  listFalsePositives,
  markFalsePositive,
  unmarkFalsePositive,
  type FalsePositive,
} from "../../../../src/scan-store";
import { logAudit } from "../../../../src/audit-log";

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

  const fps = await listFalsePositives();
  return NextResponse.json({ falsePositives: fps, count: fps.length });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.findingHash || !body?.repo || !body?.file || !body?.reason) {
    return NextResponse.json(
      { error: "findingHash, repo, file, and reason are required" },
      { status: 400 },
    );
  }

  const actor = (session.user as Record<string, unknown>).githubUsername as string ?? "unknown";

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
  const session = await getSession(request);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.findingHash) {
    return NextResponse.json({ error: "findingHash is required" }, { status: 400 });
  }

  const actor = (session.user as Record<string, unknown>).githubUsername as string ?? "unknown";

  await unmarkFalsePositive(body.findingHash);
  await logAudit(actor, "FP_UNMARK", body.findingHash, "Removed false positive marker");

  return NextResponse.json({ removed: true });
}
