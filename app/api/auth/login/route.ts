import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { generateMagicToken, isAllowedAdmin } from "../../../../src/auth";

export const runtime = "nodejs";

const LoginSchema = z.object({
  email: z.string().email().max(254),
});

let resendClient: Resend | null = null;
function getResend(): Resend {
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Ongeldig e-mailadres" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();

  // Always return success to prevent email enumeration
  if (!isAllowedAdmin(email)) {
    console.log(`[auth] Login attempt for non-admin email: ${email}`);
    return NextResponse.json({ ok: true });
  }

  const { token } = generateMagicToken(email);

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
  const verifyUrl = `${baseUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;

  const from = process.env.SCAN_EMAIL_FROM;
  if (!from) {
    console.error("[auth] SCAN_EMAIL_FROM not configured");
    return NextResponse.json({ error: "Server configuratiefout" }, { status: 500 });
  }

  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: "Git Guardian — Inloglink",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #2ea043;">Git Guardian</h2>
          <p>Je hebt een inloglink aangevraagd voor het Security Operations Portal.</p>
          <p>
            <a href="${verifyUrl}" style="
              display: inline-block;
              padding: 12px 24px;
              background: #2ea043;
              color: #fff;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
            ">Inloggen</a>
          </p>
          <p style="color: #6b7280; font-size: 13px;">
            Deze link is 10 minuten geldig en werkt eenmalig.<br/>
            Heb je dit niet aangevraagd? Negeer deze e-mail.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("[auth] Resend error:", error);
      return NextResponse.json({ error: "Kon e-mail niet verzenden" }, { status: 500 });
    }

    console.log(`[auth] Magic link sent to ${email}`);
  } catch (error) {
    console.error(`[auth] Failed to send magic link: ${String(error)}`);
    return NextResponse.json({ error: "Kon e-mail niet verzenden" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
