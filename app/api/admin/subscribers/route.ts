import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../src/auth";
import { listSubscribers, addSubscriber, removeSubscriber } from "../../../../src/subscribers";
import { logAudit } from "../../../../src/audit-log";
import { SubscriberInput } from "../../../../src/types";

export const runtime = "nodejs";

export async function GET() {
  await requireAdmin();

  const subscribers = await listSubscribers();
  return NextResponse.json({ subscribers, count: subscribers.length });
}

export async function POST(request: NextRequest) {
  const actor = await requireAdmin();

  const body = await request.json().catch(() => null);
  const parsed = SubscriberInput.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ongeldige invoer", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { githubUsername, email, isOwner } = parsed.data;
  const subscriber = await addSubscriber(githubUsername, email, isOwner ?? false);
  await logAudit(actor, "SUBSCRIBER_ADD", githubUsername, `Added subscriber ${githubUsername} (${email})`);

  return NextResponse.json({ subscriber }, { status: 201 });
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
