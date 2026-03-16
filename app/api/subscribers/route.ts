import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  listSubscribers,
  addSubscriber,
  removeSubscriber,
  verifyUnsubscribeToken,
} from "../../../src/subscribers";
import { safeCompare } from "../../../src/crypto-utils";
import { SubscriberInput } from "../../../src/types";

// ---------------------------------------------------------------------------
// Subscriber CRUD — GET/POST/DELETE /api/subscribers
// ---------------------------------------------------------------------------

export const runtime = "nodejs";

/**
 * GET: list all subscribers (protected by CRON_SECRET)
 */
export async function GET(request: NextRequest) {
  // Check for unsubscribe action
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "unsubscribe") {
    const token = searchParams.get("token") ?? "";
    const username = searchParams.get("username") ?? "";

    if (!username || !token || !verifyUnsubscribeToken(username, token)) {
      return NextResponse.json({ error: "Invalid unsubscribe link" }, { status: 400 });
    }

    await removeSubscriber(username);
    const safeUsername = username
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    return new NextResponse(
      `<html><body style="font-family:sans-serif;max-width:600px;margin:80px auto;text-align:center;">
        <h1>Uitgeschreven</h1>
        <p>${safeUsername} ontvangt geen dagelijkse scanrapporten meer.</p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }

  // List subscribers (admin only)
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || !auth || !safeCompare(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscribers = await listSubscribers();
  return NextResponse.json({ subscribers, count: subscribers.length });
}

/**
 * POST: add a subscriber (from the web page)
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = SubscriberInput.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ongeldige invoer", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const subscriber = await addSubscriber(parsed.data.githubUsername, parsed.data.email);
  return NextResponse.json({ subscriber }, { status: 201 });
}

/**
 * DELETE: remove a subscriber (admin only)
 */
export async function DELETE(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || !auth || !safeCompare(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.githubUsername) {
    return NextResponse.json(
      { error: "githubUsername is required" },
      { status: 400 },
    );
  }

  const removed = await removeSubscriber(body.githubUsername);
  return NextResponse.json({ removed });
}
