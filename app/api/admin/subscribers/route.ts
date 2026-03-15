import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../src/auth";
import { listSubscribers, addSubscriber, removeSubscriber, getSubscriber, updateSubscriberSettings } from "../../../../src/subscribers";
import { logAudit } from "../../../../src/audit-log";

export const runtime = "nodejs";

export async function GET() {
  await requireAdmin();

  const subscribers = await listSubscribers();
  return NextResponse.json({ subscribers, count: subscribers.length });
}

export async function POST(request: NextRequest) {
  const actor = await requireAdmin();

  const body = await request.json().catch(() => null);
  if (!body?.githubUsername || !body?.email) {
    return NextResponse.json(
      { error: "githubUsername and email are required" },
      { status: 400 },
    );
  }

  const subscriber = await addSubscriber(body.githubUsername, body.email, body.isOwner ?? false);
  await logAudit(actor, "SUBSCRIBER_ADD", body.githubUsername, `Added subscriber ${body.githubUsername} (${body.email})`);

  return NextResponse.json({ subscriber }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const actor = await requireAdmin();

  const body = await request.json().catch(() => null);
  if (!body?.githubUsername) {
    return NextResponse.json({ error: "githubUsername is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.deepseekEnabled === "boolean") updates.deepseekEnabled = body.deepseekEnabled;
  if (["daily", "weekly", "monthly"].includes(body.scanFrequency)) updates.scanFrequency = body.scanFrequency;

  await updateSubscriberSettings(body.githubUsername, updates);
  await logAudit(actor, "SUBSCRIBER_UPDATE", body.githubUsername, `Updated: ${JSON.stringify(updates)}`);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const actor = await requireAdmin();

  const body = await request.json().catch(() => null);
  if (!body?.githubUsername) {
    return NextResponse.json({ error: "githubUsername is required" }, { status: 400 });
  }

  const removed = await removeSubscriber(body.githubUsername);
  await logAudit(actor, "SUBSCRIBER_REMOVE", body.githubUsername, `Removed subscriber ${body.githubUsername}`);

  return NextResponse.json({ removed });
}
