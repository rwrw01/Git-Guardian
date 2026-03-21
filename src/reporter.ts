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
// HTML rendering helpers
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<string, string> = {
  [Severity.CRITICAL]: "#DC2626",
  [Severity.HIGH]: "#EA580C",
  [Severity.MEDIUM]: "#CA8A04",
  [Severity.LOW]: "#2563EB",
};

const MATURITY_LABELS = ["", "Afwezig", "Minimaal", "Basis", "Goed", "Best practice"];
const MATURITY_COLORS = ["", "#DC2626", "#EA580C", "#CA8A04", "#65a30d", "#16a34a"];

const CATEGORY_LABELS: Record<string, string> = {
  [Category.SECRET]: "Secrets & Tokens",
  [Category.DEPENDENCY]: "Dependency CVEs",
  [Category.PII]: "Persoonsgegevens (PII)",
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  [Category.SECRET]: "API keys, tokens, wachtwoorden, private keys, database URLs (20+ patronen + entropy analyse)",
  [Category.DEPENDENCY]: "Bekende kwetsbaarheden (CVEs) in npm, PyPI, Go en Maven packages via OSV.dev",
  [Category.PII]: "BSN (elfproef), IBAN (mod-97), e-mailadressen, telefoonnummers, KvK-nummers, postcodes (NL-specifiek)",
};

function severityBadge(severity: Severity): string {
  const color = SEVERITY_COLORS[severity];
  return `<span style="background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:bold;">${severity}</span>`;
}

function countBySeverity(findings: Finding[], severity: Severity): number {
  return findings.filter((f) => f.severity === severity).length;
}

// ---------------------------------------------------------------------------
// Scan overview table — one row per scan type with severity counts
// ---------------------------------------------------------------------------

function scanOverviewTable(findings: Finding[]): string {
  const categories = [Category.SECRET, Category.DEPENDENCY, Category.PII];

  const rows = categories
    .map((cat) => {
      const catFindings = findings.filter((f) => f.category === cat);
      const c = countBySeverity(catFindings, Severity.CRITICAL);
      const h = countBySeverity(catFindings, Severity.HIGH);
      const m = countBySeverity(catFindings, Severity.MEDIUM);
      const l = countBySeverity(catFindings, Severity.LOW);
      const total = catFindings.length;
      const worst = c > 0 ? Severity.CRITICAL : h > 0 ? Severity.HIGH : m > 0 ? Severity.MEDIUM : total > 0 ? Severity.LOW : null;

      return `<tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:10px 12px;font-weight:600;">${CATEGORY_LABELS[cat]}</td>
        <td style="padding:10px 8px;font-size:12px;color:#6b7280;">${CATEGORY_DESCRIPTIONS[cat]}</td>
        <td style="padding:10px 8px;text-align:center;">${c > 0 ? severityBadge(Severity.CRITICAL) + ` ${c}` : "—"}</td>
        <td style="padding:10px 8px;text-align:center;">${h > 0 ? severityBadge(Severity.HIGH) + ` ${h}` : "—"}</td>
        <td style="padding:10px 8px;text-align:center;">${m > 0 ? severityBadge(Severity.MEDIUM) + ` ${m}` : "—"}</td>
        <td style="padding:10px 8px;text-align:center;">${l > 0 ? `${l}` : "—"}</td>
        <td style="padding:10px 8px;text-align:center;font-weight:bold;">${total}</td>
        <td style="padding:10px 8px;text-align:center;">${worst ? severityBadge(worst) : '<span style="color:#16a34a;font-weight:bold;">CLEAN</span>'}</td>
      </tr>`;
    })
    .join("\n");

  return `<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead>
      <tr style="border-bottom:2px solid #1f2937;text-align:left;">
        <th style="padding:8px 12px;">Scan</th>
        <th style="padding:8px;">Wat wordt getest</th>
        <th style="padding:8px;text-align:center;">Critical</th>
        <th style="padding:8px;text-align:center;">High</th>
        <th style="padding:8px;text-align:center;">Medium</th>
        <th style="padding:8px;text-align:center;">Low</th>
        <th style="padding:8px;text-align:center;">Totaal</th>
        <th style="padding:8px;text-align:center;">Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ---------------------------------------------------------------------------
// Findings table per category, grouped by repo
// ---------------------------------------------------------------------------

function findingsByCategory(findings: Finding[], category: Category): string {
  const catFindings = findings.filter((f) => f.category === category);
  if (catFindings.length === 0) return "";

  // Group by repo
  const byRepo = new Map<string, Finding[]>();
  for (const f of catFindings) {
    const existing = byRepo.get(f.repo) ?? [];
    existing.push(f);
    byRepo.set(f.repo, existing);
  }

  let html = `<h2 style="margin-top:32px;padding-top:16px;border-top:2px solid #e5e7eb;">${CATEGORY_LABELS[category]}</h2>`;

  for (const [repo, repoFindings] of byRepo) {
    const repoShort = repo.split("/").pop() ?? repo;
    html += `<h3 style="margin-top:16px;margin-bottom:8px;">
      <code style="background:#f3f4f6;padding:2px 8px;border-radius:4px;font-size:14px;">${repoShort}</code>
      <span style="font-size:12px;color:#6b7280;font-weight:normal;margin-left:8px;">${repo} — ${repoFindings.length} bevinding${repoFindings.length !== 1 ? "en" : ""}</span>
    </h3>`;

    const rows = repoFindings
      .map(
        (f) => `<tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:6px 8px;">${severityBadge(f.severity)}</td>
        <td style="padding:6px 8px;"><code style="font-size:12px;">${f.file}${f.line ? `:${f.line}` : ""}</code></td>
        <td style="padding:6px 8px;">${f.description}${f.maskedValue ? `<br><code style="font-size:11px;color:#6b7280;background:#f9fafb;padding:1px 4px;border-radius:2px;">${f.maskedValue}</code>` : ""}</td>
        <td style="padding:6px 8px;font-size:12px;color:#6b7280;">${f.fix}</td>
      </tr>`,
      )
      .join("\n");

    html += `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:12px;">
      <thead>
        <tr style="border-bottom:1px solid #d1d5db;text-align:left;">
          <th style="padding:6px 8px;width:80px;">Ernst</th>
          <th style="padding:6px 8px;">Locatie</th>
          <th style="padding:6px 8px;">Beschrijving</th>
          <th style="padding:6px 8px;">Actie</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  return html;
}

// ---------------------------------------------------------------------------
// Render full report HTML
// ---------------------------------------------------------------------------

export function renderReportHtml(
  report: ScanReport,
  mistralAnalysis?: string | null,
): string {
  const { findings } = report;
  const critical = findings.filter((f) => f.severity === Severity.CRITICAL);
  const high = findings.filter((f) => f.severity === Severity.HIGH);
  const medium = findings.filter((f) => f.severity === Severity.MEDIUM);

  const date = new Date(report.scannedAt).toLocaleDateString("nl-NL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:900px;margin:0 auto;padding:20px;color:#1f2937;">

<h1 style="border-bottom:3px solid #1f2937;padding-bottom:8px;">Git Guardian — Scanrapport</h1>

${report.reportType === "delta" ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:#1e40af;">
  <strong>Delta-rapport</strong> — alleen nieuwe bevindingen sinds de vorige scan.
  ${report.previousFindingsCount ? `${report.previousFindingsCount} eerder gemelde bevinding${report.previousFindingsCount !== 1 ? "en" : ""} niet opnieuw getoond.` : ""}
  Op de 1e van de maand ontvangt u het volledige overzicht.
</div>` : report.reportType === "full" ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:#166534;">
  <strong>Volledig maandoverzicht</strong> — alle bevindingen over al uw repositories.
</div>` : ""}

<!-- Management samenvatting -->
<div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:24px;">
  <div>
    <table style="font-size:14px;border-collapse:collapse;">
      <tr><td style="padding:4px 16px 4px 0;color:#6b7280;">Gebruiker</td><td><strong>${report.githubUsername}</strong></td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b7280;">Datum</td><td>${date}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b7280;">Repositories</td><td>${report.totalRepos}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b7280;">Bevindingen</td><td><strong>${findings.length}</strong></td></tr>
    </table>
  </div>
  <div>
    <table style="font-size:14px;border-collapse:collapse;">
      <tr>
        <td style="padding:4px 12px 4px 0;color:#6b7280;">Maturity</td>
        <td style="padding:4px 0;">
          <strong style="color:${MATURITY_COLORS[report.maturity.secrets]};">Secrets ${report.maturity.secrets}/5</strong> ·
          <strong style="color:${MATURITY_COLORS[report.maturity.dependencies]};">Deps ${report.maturity.dependencies}/5</strong> ·
          <strong style="color:${MATURITY_COLORS[report.maturity.pii]};">PII ${report.maturity.pii}/5</strong>
        </td>
      </tr>
      <tr>
        <td style="padding:4px 12px 4px 0;color:#6b7280;">Scores</td>
        <td style="padding:4px 0;font-size:12px;color:#6b7280;">
          1 Afwezig · 2 Minimaal · 3 Basis · 4 Goed · 5 Best practice
        </td>
      </tr>
    </table>
  </div>
</div>

<!-- Scan overzicht -->
<h2>Uitgevoerde scans</h2>
${scanOverviewTable(findings)}

<!-- Bevindingen per categorie, gegroepeerd per repo -->
${findingsByCategory(findings, Category.SECRET)}
${findingsByCategory(findings, Category.DEPENDENCY)}
${findingsByCategory(findings, Category.PII)}

${
  mistralAnalysis
    ? `<h2 style="margin-top:32px;padding-top:16px;border-top:2px solid #e5e7eb;">AI-analyse (Mistral)</h2>
<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;white-space:pre-wrap;font-size:13px;line-height:1.6;">${mistralAnalysis}</div>`
    : ""
}

<!-- Actielijst -->
<h2 style="margin-top:32px;padding-top:16px;border-top:2px solid #e5e7eb;">Actielijst</h2>
<ol style="line-height:1.8;">
${critical.map((f) => `<li>${severityBadge(Severity.CRITICAL)} <strong>[ONMIDDELLIJK]</strong> ${f.description} in <code>${f.repo}/${f.file}</code><br><span style="font-size:12px;color:#6b7280;">${f.fix}</span></li>`).join("\n")}
${high.map((f) => `<li>${severityBadge(Severity.HIGH)} <strong>[DEZE WEEK]</strong> ${f.description} in <code>${f.repo}/${f.file}</code><br><span style="font-size:12px;color:#6b7280;">${f.fix}</span></li>`).join("\n")}
${medium.map((f) => `<li>${severityBadge(Severity.MEDIUM)} <strong>[GEPLAND]</strong> ${f.description} in <code>${f.repo}/${f.file}</code><br><span style="font-size:12px;color:#6b7280;">${f.fix}</span></li>`).join("\n")}
</ol>

<hr style="margin-top:40px;border:none;border-top:1px solid #e5e7eb;">
<p style="font-size:12px;color:#6b7280;">
  Dit rapport is automatisch gegenereerd door <strong>Git Guardian</strong>.<br>
  {{UNSUBSCRIBE_LINK}}
</p>

</body>
</html>`;
}
