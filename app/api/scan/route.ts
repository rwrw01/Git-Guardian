import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Finding } from "../../../src/types";
import { checkRateLimit, listPublicRepos, getRepoTree, getFileContent } from "../../../src/github";
import { getRedis } from "../../../src/redis";
import { scanForSecrets } from "../../../src/secrets";
import { scanForPii } from "../../../src/pii";
import { scanForDependencyVulns } from "../../../src/dependencies";
import { analyzeWithDeepSeek } from "../../../src/deepseek";
import { buildReport } from "../../../src/reporter";
import { sendReportEmail } from "../../../src/email";
import {
  listSubscribers,
  updateLastScan,
  generateUnsubscribeToken,
} from "../../../src/subscribers";
import {
  saveScanReport,
  classifyFindings,
  saveKnownFindings,
  filterFalsePositives,
  getConfig,
} from "../../../src/scan-store";

// ---------------------------------------------------------------------------
// Daily cron endpoint — POST /api/scan
// Vercel cron triggers this at 06:00 UTC
// ---------------------------------------------------------------------------

export const runtime = "nodejs";

async function scanRepoFiles(
  owner: string,
  repo: string,
  branch: string,
): Promise<Array<{ path: string; content: string }>> {
  const tree = await getRepoTree(owner, repo, branch);
  const files: Array<{ path: string; content: string }> = [];

  // Fetch files in batches of 10 to respect rate limits
  const BATCH_SIZE = 25;
  for (let i = 0; i < tree.length; i += BATCH_SIZE) {
    const batch = tree.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (entry) => {
        const content = await getFileContent(owner, repo, entry.path);
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

  return files;
}

async function scanSubscriber(
  username: string,
  useDeepseek: boolean,
): Promise<{ findings: Finding[]; repoCount: number; error?: string }> {
  const repos = await listPublicRepos(username);
  const allFindings: Finding[] = [];

  for (const repo of repos) {
    try {
      const files = await scanRepoFiles(username, repo.name, repo.default_branch);

      // Run scans in parallel
      const [secretResult, piiResult, depResult] = await Promise.all([
        Promise.resolve(scanForSecrets(files, repo.full_name)),
        Promise.resolve(scanForPii(files, repo.full_name)),
        scanForDependencyVulns(files, repo.full_name),
      ]);

      if (secretResult.ok) allFindings.push(...secretResult.findings);
      if (piiResult.ok) allFindings.push(...piiResult.findings);
      if (depResult.ok) allFindings.push(...depResult.findings);
    } catch (error) {
      console.error(`[scan] Error scanning ${repo.full_name}: ${String(error)}`);
    }
  }

  return { findings: allFindings, repoCount: repos.length };
}

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if this is the right time to scan based on configured frequency
  const now = new Date();
  const scanHourUtc = await getConfig("scan-hour-utc", 6);

  if (now.getUTCHours() !== scanHourUtc) {
    return NextResponse.json({ message: "Not scan hour", skipped: true });
  }

  try {
    const allSubscribers = await listSubscribers();

    // Filter subscribers by their individual scan frequency
    const subscribers = allSubscribers.filter((sub) => {
      const freq = sub.scanFrequency ?? "daily";
      if (freq === "daily") return true;
      if (freq === "weekly") return now.getUTCDay() === 1; // Monday
      if (freq === "monthly") return now.getUTCDate() === 1; // 1st of month
      return true;
    });

    if (subscribers.length === 0) {
      return NextResponse.json({ message: "No subscribers", scanned: 0 });
    }

    const results: Array<{ username: string; findings: number; emailed: boolean }> = [];

    // Process subscribers sequentially to manage rate limits
    for (const sub of subscribers) {
      console.log(`[scan] Scanning ${sub.githubUsername}...`);

      const { findings, repoCount } = await scanSubscriber(
        sub.githubUsername,
        sub.deepseekEnabled,
      );

      // Filter out false positives, then classify as new/known
      const realFindings = await filterFalsePositives(findings);
      const { newFindings, knownFindings } = await classifyFindings(
        sub.githubUsername,
        realFindings,
      );

      // Determine report type: full on configured day of month, delta otherwise
      const fullReportDay = await getConfig("full-report-day", 1);
      const isFullReportDay = new Date().getDate() === fullReportDay;
      const reportFindings = isFullReportDay ? findings : newFindings;

      const report = buildReport(sub.githubUsername, repoCount, reportFindings);
      report.reportType = isFullReportDay ? "full" : "delta";
      report.previousFindingsCount = knownFindings.length;

      // DeepSeek analysis for owner only (only when there are new findings)
      let deepseekAnalysis: string | null = null;
      if (sub.deepseekEnabled && newFindings.length > 0) {
        const codeContext = newFindings
          .slice(0, 10)
          .map((f) => `${f.file}:${f.line} — ${f.description}`)
          .join("\n");
        deepseekAnalysis = await analyzeWithDeepSeek(newFindings, codeContext);
      }

      if (deepseekAnalysis) {
        report.deepseekAnalysis = deepseekAnalysis;
      }

      // Save report and update known findings
      await saveScanReport(report);
      await saveKnownFindings(sub.githubUsername, findings);

      // Only send email if there are new findings or it's full report day
      let emailed = false;
      if (newFindings.length > 0 || isFullReportDay) {
        const token = generateUnsubscribeToken(sub.githubUsername);
        emailed = await sendReportEmail(
          report,
          sub.email,
          token,
          deepseekAnalysis,
        );
      }

      await updateLastScan(sub.githubUsername);

      results.push({
        username: sub.githubUsername,
        findings: findings.length,
        emailed,
      });

      console.log(
        `[scan] ${sub.githubUsername}: ${findings.length} findings, emailed=${emailed}`,
      );
    }

    // Process queued self-service scans if we have API budget left
    const queueProcessed = await processQueue();

    return NextResponse.json({
      message: "Scan complete",
      scanned: results.length,
      queueProcessed,
      results,
    });
  } catch (error) {
    console.error(`[scan] Fatal error: ${String(error)}`);
    return NextResponse.json(
      { error: "Scan failed", message: String(error) },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Process queued self-service scans
// ---------------------------------------------------------------------------

async function processQueue(): Promise<number> {
  const redis = getRedis();
  const items = await redis.zrange<string[]>("scan-queue", 0, 9);
  if (!items || items.length === 0) return 0;

  const rateStatus = await checkRateLimit();
  if (rateStatus.remaining < 100) {
    console.log(`[scan-queue] Skipping queue: only ${rateStatus.remaining} API calls left`);
    return 0;
  }

  let processed = 0;

  for (const raw of items) {
    const item = JSON.parse(raw) as { githubUsername: string; email: string };

    try {
      console.log(`[scan-queue] Processing queued scan for ${item.githubUsername}`);
      const repos = await listPublicRepos(item.githubUsername);
      const allFindings: Finding[] = [];

      for (const repo of repos) {
        try {
          const tree = await getRepoTree(item.githubUsername, repo.name, repo.default_branch);
          const files: Array<{ path: string; content: string }> = [];

          const BATCH_SIZE = 25;
          for (let i = 0; i < tree.length; i += BATCH_SIZE) {
            const batch = tree.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(
              batch.map(async (entry) => {
                const content = await getFileContent(item.githubUsername, repo.name, entry.path);
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

          const [s, p, d] = await Promise.all([
            Promise.resolve(scanForSecrets(files, repo.full_name)),
            Promise.resolve(scanForPii(files, repo.full_name)),
            scanForDependencyVulns(files, repo.full_name),
          ]);

          if (s.ok) allFindings.push(...s.findings);
          if (p.ok) allFindings.push(...p.findings);
          if (d.ok) allFindings.push(...d.findings);
        } catch (err) {
          console.error(`[scan-queue] Error scanning ${repo.full_name}: ${String(err)}`);
        }
      }

      const realQueueFindings = await filterFalsePositives(allFindings);
      const report = buildReport(item.githubUsername, repos.length, realQueueFindings);
      const token = generateUnsubscribeToken(item.githubUsername);
      await sendReportEmail(report, item.email, token);

      // Remove from queue
      await redis.zrem("scan-queue", raw);
      processed++;
      console.log(`[scan-queue] Completed queued scan for ${item.githubUsername}: ${allFindings.length} findings`);
    } catch (err) {
      console.error(`[scan-queue] Failed to process ${item.githubUsername}: ${String(err)}`);
      // Remove failed item too (prevent infinite retry)
      await redis.zrem("scan-queue", raw);
    }
  }

  return processed;
}
