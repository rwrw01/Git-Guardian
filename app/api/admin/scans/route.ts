import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../src/auth";
import { getScanReports, getScanReport, countScanReports, getConfig, setConfig, filterFalsePositives } from "../../../../src/scan-store";
import { logAudit } from "../../../../src/audit-log";
import { checkRateLimit, listPublicRepos, getRepoTree, getFileContent } from "../../../../src/github";
import { getRedis } from "../../../../src/redis";
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

/**
 * GET: list scan history or get single report
 */
export async function GET(request: NextRequest) {
  const actor = await requireAdmin();

  const { searchParams } = new URL(request.url);

  // Health check endpoint
  if (searchParams.get("health") === "true") {
    const redis = getRedis();
    const rateStatus = await checkRateLimit();
    let redisUsagePercent = 0;
    try {
      const infoStr = await redis.info("memory");
      const usedMatch = infoStr.match(/used_memory:(\d+)/);
      const maxMatch = infoStr.match(/maxmemory:(\d+)/);
      if (usedMatch && maxMatch && parseInt(maxMatch[1], 10) > 0) {
        redisUsagePercent = Math.round(
          (parseInt(usedMatch[1], 10) / parseInt(maxMatch[1], 10)) * 100,
        );
      }
    } catch { /* Redis info not available */ }

    // Get running scans
    const runningScans: Array<Record<string, unknown>> = [];
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, { match: "running-scan:*", count: 20 });
      cursor = next;
      for (const k of keys) {
        const val = await redis.get<Record<string, unknown>>(k);
        if (val) runningScans.push(val);
      }
    } while (cursor !== "0");

    // Get queued scans count
    const queuedCount = await redis.zcard("scan-queue");

    return NextResponse.json({
      redisUsagePercent,
      githubRateRemaining: rateStatus.remaining,
      githubRateLimit: rateStatus.limit,
      githubRateResetMin: rateStatus.resetMinutes,
      runningScans,
      queuedCount,
    });
  }

  // DeepSeek prompt endpoint
  if (searchParams.get("deepseek-prompt") === "true") {
    const { DEEPSEEK_SYSTEM_PROMPT } = await import("../../../../src/deepseek");
    return NextResponse.json({ prompt: DEEPSEEK_SYSTEM_PROMPT });
  }

  // Config endpoint
  if (searchParams.get("config") === "true") {
    const scanFrequency = await getConfig("scan-frequency", "daily");
    const scanHourUtc = await getConfig("scan-hour-utc", 6);
    const scanDayOfWeek = await getConfig("scan-day-of-week", 1);
    const fullReportDay = await getConfig("full-report-day", 1);
    return NextResponse.json({ scanFrequency, scanHourUtc, scanDayOfWeek, fullReportDay });
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
  const actor = await requireAdmin();

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (["daily", "weekly", "monthly"].includes(body.scanFrequency)) {
    await setConfig("scan-frequency", body.scanFrequency);
  }
  if (typeof body.scanHourUtc === "number" && body.scanHourUtc >= 0 && body.scanHourUtc <= 23) {
    await setConfig("scan-hour-utc", body.scanHourUtc);
  }
  if (typeof body.scanDayOfWeek === "number" && body.scanDayOfWeek >= 0 && body.scanDayOfWeek <= 28) {
    await setConfig("scan-day-of-week", body.scanDayOfWeek);
  }
  if (typeof body.fullReportDay === "number" && body.fullReportDay >= 1 && body.fullReportDay <= 28) {
    await setConfig("full-report-day", body.fullReportDay);
  }

  await logAudit(actor, "CONFIG_UPDATE", "scan-settings", `Updated: freq=${body.scanFrequency}, hour=${body.scanHourUtc}, day=${body.scanDayOfWeek}, fullReport=${body.fullReportDay}`);

  return NextResponse.json({ ok: true });
}

/**
 * POST: trigger a manual scan for a specific username
 */
export async function POST(request: NextRequest) {
  const actor = await requireAdmin();

  const body = await request.json().catch(() => null);
  if (!body?.githubUsername) {
    return NextResponse.json({ error: "githubUsername is required" }, { status: 400 });
  }
  const targetUsername = body.githubUsername as string;
  const useDeepseek = body.useDeepseek ?? false;

  await logAudit(actor, "SCAN_MANUAL", targetUsername, `Manual scan triggered${useDeepseek ? " with DeepSeek" : ""}`);

  // Track running scan in Redis (visible across page navigation)
  const redis = getRedis();
  const scanKey = `running-scan:${targetUsername}`;
  await redis.set(scanKey, {
    username: targetUsername,
    startedBy: actor,
    startedAt: new Date().toISOString(),
    useDeepseek,
    status: "scanning",
  }, { ex: 600 }); // Auto-expire after 10 min (safety net)

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

    const filteredFindings = await filterFalsePositives(allFindings);
    const report = buildReport(targetUsername, repos.length, filteredFindings);

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

    await redis.del(scanKey);
    await logAudit(actor, "SCAN_COMPLETE", targetUsername, `Scan complete: ${allFindings.length} findings in ${repos.length} repos`);

    return NextResponse.json({
      scanId,
      findings: allFindings.length,
      repos: repos.length,
      hasDeepseekAnalysis: !!deepseekAnalysis,
    });
  } catch (error) {
    await redis.del(scanKey);
    await logAudit(actor, "SCAN_ERROR", targetUsername, `Scan failed: ${String(error)}`);
    return NextResponse.json({ error: "Scan failed", message: String(error) }, { status: 500 });
  }
}
