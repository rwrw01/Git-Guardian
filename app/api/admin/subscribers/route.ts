import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "../../../../src/auth";
import { listSubscribers, addSubscriber, removeSubscriber } from "../../../../src/subscribers";
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

  const subscribers = await listSubscribers();
  return NextResponse.json({ subscribers, count: subscribers.length });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.githubUsername || !body?.email) {
    return NextResponse.json(
      { error: "githubUsername and email are required" },
      { status: 400 },
    );
  }

  const subscriber = await addSubscriber(body.githubUsername, body.email, body.isOwner ?? false);
  const actor = (session.user as Record<string, unknown>).githubUsername as string ?? session.user.email ?? "unknown";
  await logAudit(actor, "SUBSCRIBER_ADD", body.githubUsername, `Added subscriber ${body.githubUsername} (${body.email})`);

  return NextResponse.json({ subscriber }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession(request);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.githubUsername) {
    return NextResponse.json({ error: "githubUsername is required" }, { status: 400 });
  }

  const removed = await removeSubscriber(body.githubUsername);
  const actor = (session.user as Record<string, unknown>).githubUsername as string ?? session.user.email ?? "unknown";
  await logAudit(actor, "SUBSCRIBER_REMOVE", body.githubUsername, `Removed subscriber ${body.githubUsername}`);

  return NextResponse.json({ removed });
}
