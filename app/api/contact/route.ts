import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sendGenericEmail } from "../../../src/email";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body?.name || !body?.email || !body?.message) {
    return NextResponse.json(
      { error: "Naam, e-mail en bericht zijn verplicht" },
      { status: 400 },
    );
  }

  try {
    const sent = await sendGenericEmail(
      "scan@athide.nl",
      `[Git Guardian] Contactverzoek van ${body.name}${body.organisation ? ` (${body.organisation})` : ""}`,
      `<h2>Contactverzoek via Git Guardian</h2>
<table style="font-size:14px;border-collapse:collapse;">
  <tr><td style="padding:4px 12px 4px 0;color:#666;"><strong>Naam</strong></td><td>${escapeHtml(body.name)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#666;"><strong>E-mail</strong></td><td><a href="mailto:${escapeHtml(body.email)}">${escapeHtml(body.email)}</a></td></tr>
  ${body.organisation ? `<tr><td style="padding:4px 12px 4px 0;color:#666;"><strong>Organisatie</strong></td><td>${escapeHtml(body.organisation)}</td></tr>` : ""}
  ${body.githubOrg ? `<tr><td style="padding:4px 12px 4px 0;color:#666;"><strong>GitHub</strong></td><td><a href="https://github.com/${escapeHtml(body.githubOrg)}">${escapeHtml(body.githubOrg)}</a></td></tr>` : ""}
</table>
<h3>Bericht</h3>
<p style="white-space:pre-wrap;">${escapeHtml(body.message)}</p>
<hr>
<p style="font-size:12px;color:#999;">Verzonden via het Git Guardian contactformulier</p>`,
    );

    if (!sent) {
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
