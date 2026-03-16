import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Resend } from "resend";
import { ContactInput } from "../../../src/types";
import { getRedis } from "../../../src/redis";

const RATE_LIMIT_SECONDS = 3600;
const RATE_LIMIT_MAX = 3;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = ContactInput.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ongeldige invoer", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Rate limiting: max 3 contact messages per IP per hour
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimitKey = `ratelimit:contact:${ip}`;
  const redis = getRedis();
  const count = await redis.get<number>(rateLimitKey);

  if (count !== null && count >= RATE_LIMIT_MAX) {
    return NextResponse.json(
      { error: "Te veel berichten verzonden. Probeer het later opnieuw." },
      { status: 429 },
    );
  }

  await redis.set(rateLimitKey, (count ?? 0) + 1, { ex: RATE_LIMIT_SECONDS });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SCAN_EMAIL_FROM;
  if (!apiKey || !from) {
    return NextResponse.json(
      { error: "E-mailconfiguratie ontbreekt" },
      { status: 500 },
    );
  }

  const { name, email, message, organisation, githubOrg } = parsed.data;
  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from,
      to: "scan@athide.nl",
      replyTo: email,
      subject: `[Git Guardian] Contactverzoek van ${name}${organisation ? ` (${organisation})` : ""}`,
      html: `<h2>Contactverzoek via Git Guardian</h2>
<table style="font-size:14px;border-collapse:collapse;">
  <tr><td style="padding:4px 12px 4px 0;color:#666;"><strong>Naam</strong></td><td>${escapeHtml(name)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666;"><strong>E-mail</strong></td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
  ${organisation ? `<tr><td style="padding:4px 12px 4px 0;color:#666;"><strong>Organisatie</strong></td><td>${escapeHtml(organisation)}</td></tr>` : ""}
  ${githubOrg ? `<tr><td style="padding:4px 12px 4px 0;color:#666;"><strong>GitHub</strong></td><td><a href="https://github.com/${escapeHtml(githubOrg)}">${escapeHtml(githubOrg)}</a></td></tr>` : ""}
</table>
<h3>Bericht</h3>
<p style="white-space:pre-wrap;">${escapeHtml(message)}</p>
<hr>
<p style="font-size:12px;color:#999;">Verzonden via het Git Guardian contactformulier</p>`,
    });

    if (error) {
      console.error("[contact] Resend error:", error);
      return NextResponse.json({ error: "E-mail kon niet worden verzonden" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contact] Error:", String(err));
    return NextResponse.json({ error: "Verzenden mislukt" }, { status: 500 });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
