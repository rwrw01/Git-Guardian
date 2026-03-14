import type { Finding, ScanReport } from "./types";
import { Severity, Category } from "./types";

// ---------------------------------------------------------------------------
// Severity ordering for sorting
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<string, number> = {
  [Severity.CRITICAL]: 0,
  [Severity.HIGH]: 1,
  [Severity.MEDIUM]: 2,
  [Severity.LOW]: 3,
};

// ---------------------------------------------------------------------------
// Maturity scoring: 1 (absent) — 5 (best practice)
// Based on finding count and severity
// ---------------------------------------------------------------------------

function maturityScore(findings: Finding[], category: Category): number {
  const relevant = findings.filter((f) => f.category === category);
  const criticals = relevant.filter((f) => f.severity === Severity.CRITICAL).length;
  const highs = relevant.filter((f) => f.severity === Severity.HIGH).length;
  const mediums = relevant.filter((f) => f.severity === Severity.MEDIUM).length;

  if (criticals > 0) return 1;
  if (highs > 2) return 2;
  if (highs > 0 || mediums > 5) return 3;
  if (mediums > 0) return 4;
  return 5;
}

// ---------------------------------------------------------------------------
// Build scan report
// ---------------------------------------------------------------------------

export function buildReport(
  githubUsername: string,
  totalRepos: number,
  findings: Finding[],
): ScanReport {
  return {
    githubUsername,
    scannedAt: new Date().toISOString(),
    totalRepos,
    findings: findings.sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
    ),
    maturity: {
      secrets: maturityScore(findings, Category.SECRET),
      dependencies: maturityScore(findings, Category.DEPENDENCY),
      pii: maturityScore(findings, Category.PII),
    },
  };
}

// ---------------------------------------------------------------------------
// Render report to HTML (Dutch, per CLAUDE.md)
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<string, string> = {
  [Severity.CRITICAL]: "#DC2626",
  [Severity.HIGH]: "#EA580C",
  [Severity.MEDIUM]: "#CA8A04",
  [Severity.LOW]: "#2563EB",
};

const MATURITY_LABELS = ["", "Afwezig", "Minimaal", "Basis", "Goed", "Best practice"];

function severityBadge(severity: Severity): string {
  const color = SEVERITY_COLORS[severity];
  return `<span style="background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:bold;">${severity}</span>`;
}

function findingsTable(findings: Finding[]): string {
  if (findings.length === 0) return "<p>Geen bevindingen.</p>";

  const rows = findings
    .map(
      (f) => `<tr>
      <td>${severityBadge(f.severity)}</td>
      <td>${f.category}</td>
      <td><code>${f.file}:${f.line}</code></td>
      <td>${f.description}</td>
      <td>${f.fix}</td>
    </tr>`,
    )
    .join("\n");

  return `<table style="width:100%;border-collapse:collapse;font-size:14px;">
    <thead>
      <tr style="border-bottom:2px solid #e5e7eb;text-align:left;">
        <th style="padding:8px;">Ernst</th>
        <th style="padding:8px;">Type</th>
        <th style="padding:8px;">Locatie</th>
        <th style="padding:8px;">Beschrijving</th>
        <th style="padding:8px;">Actie</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export function renderReportHtml(
  report: ScanReport,
  deepseekAnalysis?: string | null,
): string {
  const { findings } = report;
  const critical = findings.filter((f) => f.severity === Severity.CRITICAL);
  const high = findings.filter((f) => f.severity === Severity.HIGH);
  const medium = findings.filter((f) => f.severity === Severity.MEDIUM);
  const low = findings.filter((f) => f.severity === Severity.LOW);

  const date = new Date(report.scannedAt).toLocaleDateString("nl-NL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#1f2937;">

<h1 style="border-bottom:3px solid #1f2937;padding-bottom:8px;">Repo Guardian — Scanrapport</h1>

<h2>Management samenvatting</h2>
<table style="font-size:14px;border-collapse:collapse;">
  <tr><td style="padding:4px 16px 4px 0;"><strong>Gebruiker</strong></td><td>${report.githubUsername}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;"><strong>Datum</strong></td><td>${date}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;"><strong>Gescande repositories</strong></td><td>${report.totalRepos}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;"><strong>Totaal bevindingen</strong></td><td>${findings.length}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;">${severityBadge(Severity.CRITICAL)}</td><td>${critical.length}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;">${severityBadge(Severity.HIGH)}</td><td>${high.length}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;">${severityBadge(Severity.MEDIUM)}</td><td>${medium.length}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;">${severityBadge(Severity.LOW)}</td><td>${low.length}</td></tr>
</table>

<h3>Maturity scores</h3>
<table style="font-size:14px;border-collapse:collapse;">
  <tr><td style="padding:4px 16px 4px 0;">Secrets</td><td><strong>${report.maturity.secrets}/5</strong> — ${MATURITY_LABELS[report.maturity.secrets]}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;">Dependencies</td><td><strong>${report.maturity.dependencies}/5</strong> — ${MATURITY_LABELS[report.maturity.dependencies]}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;">PII</td><td><strong>${report.maturity.pii}/5</strong> — ${MATURITY_LABELS[report.maturity.pii]}</td></tr>
</table>

${critical.length + high.length > 0 ? `<h2 style="color:${SEVERITY_COLORS[Severity.CRITICAL]};">Kritieke en hoge bevindingen</h2>${findingsTable([...critical, ...high])}` : ""}

${medium.length > 0 ? `<h2 style="color:${SEVERITY_COLORS[Severity.MEDIUM]};">Medium bevindingen</h2>${findingsTable(medium)}` : ""}

${low.length > 0 ? `<h2 style="color:${SEVERITY_COLORS[Severity.LOW]};">Lage bevindingen</h2>${findingsTable(low)}` : ""}

${
  deepseekAnalysis
    ? `<h2>AI-analyse (DeepSeek)</h2><div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;white-space:pre-wrap;font-size:13px;">${deepseekAnalysis}</div>`
    : ""
}

<h2>Actielijst</h2>
<ol>
${critical.map((f) => `<li><strong>[ONMIDDELLIJK]</strong> ${f.description} in <code>${f.file}</code> — ${f.fix}</li>`).join("\n")}
${high.map((f) => `<li><strong>[DEZE WEEK]</strong> ${f.description} in <code>${f.file}</code> — ${f.fix}</li>`).join("\n")}
${medium.map((f) => `<li><strong>[GEPLAND]</strong> ${f.description} in <code>${f.file}</code> — ${f.fix}</li>`).join("\n")}
</ol>

<hr style="margin-top:40px;border:none;border-top:1px solid #e5e7eb;">
<p style="font-size:12px;color:#6b7280;">
  Dit rapport is automatisch gegenereerd door <strong>Git Guardian</strong>.<br>
  {{UNSUBSCRIBE_LINK}}
</p>

</body>
</html>`;
}
