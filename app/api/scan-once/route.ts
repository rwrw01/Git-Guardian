import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ScanOnceInput } from "../../../src/types";
import { filterFalsePositives } from "../../../src/scan-store";
import { checkRateLimit, listPublicRepos, getRepoTree, getFileContent } from "../../../src/github";
import { scanForSecrets } from "../../../src/secrets";
import { scanForPii } from "../../../src/pii";
import { scanForDependencyVulns } from "../../../src/dependencies";
import { buildReport } from "../../../src/reporter";
import { sendReportEmail } from "../../../src/email";
import {
  addSubscriber,
  generateUnsubscribeToken,
} from "../../../src/subscribers";
import { getRedis } from "../../../src/redis";

// ---------------------------------------------------------------------------
// One-time scan endpoint — POST /api/scan-once
// Self-service: no Mistral, rate limited
// ---------------------------------------------------------------------------

export const runtime = "nodejs";

const RATE_LIMIT_SECONDS = 3600; // 1 hour
const QUEUE_KEY = "scan-queue";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = ScanOnceInput.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { githubUsername, email } = parsed.data;

  // Rate limiting: 1 scan per email per hour
  const redis = getRedis();
  const rateLimitKey = `ratelimit:scan-once:${email.toLowerCase()}`;
  const existing = await redis.get(rateLimitKey);

  if (existing) {
    return NextResponse.json(
      {
        error: "Rate limited",
        message: "Er is al een scan gestart voor dit e-mailadres. Het rapport wordt per e-mail afgeleverd.",
      },
      { status: 429 },
    );
  }

  // Set rate limit immediately so the button doesn't allow double submits
  await redis.set(rateLimitKey, 1, { ex: RATE_LIMIT_SECONDS });

  // Check GitHub API rate limit before starting
  const rateStatus = await checkRateLimit();

  if (rateStatus.remaining < 50) {
    // Not enough API calls left — queue the scan for later
    await queueScan(redis, githubUsername, email);
    await addSubscriber(githubUsername, email);

    return NextResponse.json({
      status: "queued",
      message: `Door grote drukte is je scan in de wachtrij geplaatst. Het rapport wordt binnen ${rateStatus.resetMinutes + 5} minuten per e-mail afgeleverd op ${email}.`,
    });
  }

  try {
    // Scan all public repos (no Mistral)
    const repos = await listPublicRepos(githubUsername);
    const allFindings: import("../../../src/types").Finding[] = [];

    for (const repo of repos) {
      try {
        const tree = await getRepoTree(githubUsername, repo.name, repo.default_branch);
        const files: Array<{ path: string; content: string }> = [];

        const BATCH_SIZE = 25;
        for (let i = 0; i < tree.length; i += BATCH_SIZE) {
          const batch = tree.slice(i, i + BATCH_SIZE);
          const results = await Promise.allSettled(
            batch.map(async (entry) => {
              const content = await getFileContent(githubUsername, repo.name, entry.path);
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
        console.error(`[scan-once] Error scanning ${repo.full_name}: ${String(error)}`);
      }
    }

    // Filter out findings marked as false positive
    const filteredFindings = await filterFalsePositives(allFindings);
    const report = buildReport(githubUsername, repos.length, filteredFindings);
    await addSubscriber(githubUsername, email);

    const token = generateUnsubscribeToken(githubUsername);
    await sendReportEmail(report, email, token);

    return NextResponse.json({
      status: "complete",
      message: `Scan voltooid: ${allFindings.length} bevindingen in ${repos.length} repositories. Rapport verzonden naar ${email}.`,
      summary: {
        repos: repos.length,
        findings: allFindings.length,
      },
    });
  } catch (error) {
    // If scan fails mid-way (e.g. rate limit hit during scan), queue it
    console.error(`[scan-once] Error: ${String(error)}`);

    if (String(error).includes("rate limit")) {
      await queueScan(redis, githubUsername, email);
      return NextResponse.json({
        status: "queued",
        message: `De scan is in de wachtrij geplaatst vanwege drukte op de GitHub API. Het rapport wordt zo snel mogelijk per e-mail afgeleverd op ${email}.`,
      });
    }

    return NextResponse.json(
      { error: "Scan failed", message: String(error) },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Queue helpers
// ---------------------------------------------------------------------------

interface QueueItem {
  githubUsername: string;
  email: string;
  queuedAt: string;
}

async function queueScan(
  redis: ReturnType<typeof getRedis>,
  githubUsername: string,
  email: string,
): Promise<void> {
  const item: QueueItem = {
    githubUsername,
    email,
    queuedAt: new Date().toISOString(),
  };
  await redis.zadd(QUEUE_KEY, { score: Date.now(), member: JSON.stringify(item) });
  console.log(`[scan-once] Queued scan for ${githubUsername} (${email})`);
}
