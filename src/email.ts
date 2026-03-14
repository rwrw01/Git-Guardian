import { Resend } from "resend";
import type { ScanReport } from "./types";
import { renderReportHtml } from "./reporter";

// ---------------------------------------------------------------------------
// Email delivery via Resend
// ---------------------------------------------------------------------------

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

/**
 * Send a scan report email. Only sends if there are findings (no spam on clean scans).
 * Returns true if sent successfully, false otherwise.
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

  const from = process.env.SCAN_EMAIL_FROM;
  if (!from) {
    console.error("[email] SCAN_EMAIL_FROM not configured");
    return false;
  }

  const date = new Date(report.scannedAt).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const subject = `[Repo Guardian] ${report.findings.length} bevindingen in ${report.totalRepos} repositories — ${date}`;

  let html = renderReportHtml(report, deepseekAnalysis);

  // Insert unsubscribe link
  const unsubscribeUrl = `${process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000"}/api/subscribers?action=unsubscribe&token=${encodeURIComponent(unsubscribeToken)}`;
  html = html.replace(
    "{{UNSUBSCRIBE_LINK}}",
    `<a href="${unsubscribeUrl}" style="color:#6b7280;">Uitschrijven van dagelijkse scans</a>`,
  );

  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from,
      to: recipientEmail,
      subject,
      html,
    });

    if (error) {
      console.error(`[email] Resend error:`, error);
      return false;
    }

    console.log(`[email] Report sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error(`[email] Failed to send: ${String(error)}`);
    return false;
  }
}
