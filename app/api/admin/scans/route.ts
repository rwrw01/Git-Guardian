import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "../../../../src/auth";
import { getScanReports, getScanReport, countScanReports, getConfig, setConfig } from "../../../../src/scan-store";
import { logAudit } from "../../../../src/audit-log";
import { listPublicRepos, getRepoTree, getFileContent } from "../../../../src/github";
import { scanForSecrets } from "../../../../src/secrets";
import { scanForPii } from "../../../../src/pii";
import { scanForDependencyVulns } from "../../../../src/dependencies";
import { analyzeWithDeepSeek } from "../../../../src/deepseek";
import { buildReport } from "../../../../src/reporter";
import { sendReportEmail } from "../../../../src/email";
import { saveScanReport } from "../../../../src/scan-store";
import { getSubscriber, generateUnsubscribeToken, updateLastScan } from "../../../../src/subscribers";
import type { Finding } from "../../../../src/types";

export const runtime = "nodejs";

async function getSession() {
  return auth();
}

/**
 * GET: list scan history or get single report
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  // Config endpoint
  if (searchParams.get("config") === "true") {
    const scanHourUtc = await getConfig("scan-hour-utc", 6);
    const fullReportDay = await getConfig("full-report-day", 1);
    return NextResponse.json({ scanHourUtc, fullReportDay });
  }

  const id = searchParams.get("id");

  if (id) {
    const report = await getScanReport(id);
    if (!report) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ report });
  }

  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  const reports = await getScanReports(offset, Math.min(limit, 100));
  const total = await countScanReports();

  return NextResponse.json({ reports, total, offset, limit });
}

/**
 * PUT: update scan configuration
 */
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const actor = (session.user as Record<string, unknown>).githubUsername as string ?? "unknown";

  if (typeof body.scanHourUtc === "number" && body.scanHourUtc >= 0 && body.scanHourUtc <= 23) {
    await setConfig("scan-hour-utc", body.scanHourUtc);
  }
  if (typeof body.fullReportDay === "number" && body.fullReportDay >= 1 && body.fullReportDay <= 28) {
    await setConfig("full-report-day", body.fullReportDay);
  }

  await logAudit(actor, "CONFIG_UPDATE", "scan-settings", `Updated: hour=${body.scanHourUtc}, fullReportDay=${body.fullReportDay}`);

  return NextResponse.json({ ok: true });
}

/**
 * POST: trigger a manual scan for a specific username
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.githubUsername) {
    return NextResponse.json({ error: "githubUsername is required" }, { status: 400 });
  }

  const actor = (session.user as Record<string, unknown>).githubUsername as string ?? "unknown";
  const targetUsername = body.githubUsername as string;
  const useDeepseek = body.useDeepseek ?? false;

  await logAudit(actor, "SCAN_MANUAL", targetUsername, `Manual scan triggered${useDeepseek ? " with DeepSeek" : ""}`);

  try {
    const repos = await listPublicRepos(targetUsername);
    const allFindings: Finding[] = [];

    for (const repo of repos) {
      try {
        const tree = await getRepoTree(targetUsername, repo.name, repo.default_branch);
        const files: Array<{ path: string; content: string }> = [];

        const BATCH_SIZE = 10;
        for (let i = 0; i < tree.length; i += BATCH_SIZE) {
          const batch = tree.slice(i, i + BATCH_SIZE);
          const results = await Promise.allSettled(
            batch.map(async (entry) => {
              const content = await getFileContent(targetUsername, repo.name, entry.path);
              if (content) return { path: entry.path, content };
              return null;
            }),
          );
          for (const result of results) {
            if (result.status === "fulfilled" && result.value) {
              files.push(result.value);
            }
          }
        }

        const [secretResult, piiResult, depResult] = await Promise.all([
          Promise.resolve(scanForSecrets(files, repo.full_name)),
          Promise.resolve(scanForPii(files, repo.full_name)),
          scanForDependencyVulns(files, repo.full_name),
        ]);

        if (secretResult.ok) allFindings.push(...secretResult.findings);
        if (piiResult.ok) allFindings.push(...piiResult.findings);
        if (depResult.ok) allFindings.push(...depResult.findings);
      } catch (error) {
        console.error(`[admin-scan] Error scanning ${repo.full_name}: ${String(error)}`);
      }
    }

    const report = buildReport(targetUsername, repos.length, allFindings);

    let deepseekAnalysis: string | null = null;
    if (useDeepseek && allFindings.length > 0) {
      const codeContext = allFindings
        .slice(0, 10)
        .map((f) => `${f.file}:${f.line} — ${f.description}`)
        .join("\n");
      deepseekAnalysis = await analyzeWithDeepSeek(allFindings, codeContext);
    }

    // Store DeepSeek analysis in the report
    if (deepseekAnalysis) {
      report.deepseekAnalysis = deepseekAnalysis;
    }

    const scanId = await saveScanReport(report);

    // Email the subscriber (always for admin scans with sendEmail flag)
    const sub = await getSubscriber(targetUsername);
    if (sub && body.sendEmail !== false) {
      const token = generateUnsubscribeToken(targetUsername);
      await sendReportEmail(report, sub.email, token, deepseekAnalysis);
      await updateLastScan(targetUsername);
    }

    await logAudit(actor, "SCAN_COMPLETE", targetUsername, `Scan complete: ${allFindings.length} findings in ${repos.length} repos`);

    return NextResponse.json({
      scanId,
      findings: allFindings.length,
      repos: repos.length,
      hasDeepseekAnalysis: !!deepseekAnalysis,
    });
  } catch (error) {
    await logAudit(actor, "SCAN_ERROR", targetUsername, `Scan failed: ${String(error)}`);
    return NextResponse.json({ error: "Scan failed", message: String(error) }, { status: 500 });
  }
}
