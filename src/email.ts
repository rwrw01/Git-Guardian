import type { ScanReport } from "./types";
import { renderReportHtml } from "./reporter";

// ---------------------------------------------------------------------------
// Email delivery — Microsoft Graph API (primary) or Resend (fallback)
//
// Graph API env vars:
//   GRAPH_TENANT_ID     — Azure AD tenant ID
//   GRAPH_CLIENT_ID     — App registration client ID
//   GRAPH_CLIENT_SECRET — App registration client secret
//   GRAPH_SENDER_EMAIL  — Mailbox to send from (e.g. scanner@wagter.info)
//
// Resend env vars (fallback):
//   RESEND_API_KEY      — Resend API key
//   SCAN_EMAIL_FROM     — Sender email address
// ---------------------------------------------------------------------------

function getEmailProvider(): "graph" | "resend" {
  if (
    process.env.GRAPH_TENANT_ID &&
    process.env.GRAPH_CLIENT_ID &&
    process.env.GRAPH_CLIENT_SECRET &&
    process.env.GRAPH_SENDER_EMAIL
  ) {
    return "graph";
  }
  return "resend";
}

// ---------------------------------------------------------------------------
// Microsoft Graph API — OAuth2 client credentials flow
// ---------------------------------------------------------------------------

let graphAccessToken: string | null = null;
let graphTokenExpiry = 0;

async function getGraphToken(): Promise<string> {
  if (graphAccessToken && Date.now() < graphTokenExpiry - 60_000) {
    return graphAccessToken;
  }

  const tenantId = process.env.GRAPH_TENANT_ID!;
  const clientId = process.env.GRAPH_CLIENT_ID!;
  const clientSecret = process.env.GRAPH_CLIENT_SECRET!;

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph token error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  graphAccessToken = data.access_token;
  graphTokenExpiry = Date.now() + data.expires_in * 1000;
  return graphAccessToken;
}

async function sendViaGraph(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  const token = await getGraphToken();
  const sender = process.env.GRAPH_SENDER_EMAIL!;

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${sender}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: html },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: false,
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`[email/graph] Error ${res.status}: ${err}`);
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Resend (fallback)
// ---------------------------------------------------------------------------

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.SCAN_EMAIL_FROM;

  if (!from) {
    console.error("[email/resend] SCAN_EMAIL_FROM not configured");
    return false;
  }

  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) {
    console.error("[email/resend] Error:", error);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Unified send function
// ---------------------------------------------------------------------------

async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  const provider = getEmailProvider();
  console.log(`[email] Sending via ${provider} to ${to}`);

  if (provider === "graph") {
    return sendViaGraph(to, subject, html);
  }
  return sendViaResend(to, subject, html);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a scan report email. Only sends if there are findings.
 */
export async function sendReportEmail(
  report: ScanReport,
  recipientEmail: string,
  unsubscribeToken: string,
  deepseekAnalysis?: string | null,
): Promise<boolean> {
  if (report.findings.length === 0) {
    console.log(`[email] No findings for ${report.githubUsername}, skipping email`);
    return true;
  }

  const date = new Date(report.scannedAt).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const subject = `[Git Guardian] ${report.findings.length} bevindingen in ${report.totalRepos} repositories — ${date}`;

  let html = renderReportHtml(report, deepseekAnalysis);

  const baseUrl = process.env.APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const unsubscribeUrl = `${baseUrl}/api/subscribers?action=unsubscribe&token=${encodeURIComponent(unsubscribeToken)}`;
  html = html.replace(
    "{{UNSUBSCRIBE_LINK}}",
    `<a href="${unsubscribeUrl}" style="color:#6b7280;">Uitschrijven van dagelijkse scans</a>`,
  );

  try {
    const sent = await sendEmail(recipientEmail, subject, html);
    if (sent) {
      console.log(`[email] Report sent to ${recipientEmail}`);
    }
    return sent;
  } catch (error) {
    console.error(`[email] Failed to send: ${String(error)}`);
    return false;
  }
}

/**
 * Send a generic email (for magic links, contact forms, etc.)
 */
export async function sendGenericEmail(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  try {
    return await sendEmail(to, subject, html);
  } catch (error) {
    console.error(`[email] Failed to send generic: ${String(error)}`);
    return false;
  }
}
