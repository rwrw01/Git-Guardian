import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ScanOnceInput } from "../../../src/types";
import { listPublicRepos, getRepoTree, getFileContent } from "../../../src/github";
import { scanForSecrets } from "../../../src/secrets";
import { scanForPii } from "../../../src/pii";
import { scanForDependencyVulns } from "../../../src/dependencies";
import { buildReport } from "../../../src/reporter";
import { sendReportEmail } from "../../../src/email";
import {
  addSubscriber,
  getSubscriber,
  generateUnsubscribeToken,
} from "../../../src/subscribers";
import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// One-time scan endpoint — POST /api/scan-once
// Self-service: no DeepSeek, rate limited
// ---------------------------------------------------------------------------

export const runtime = "nodejs";

const RATE_LIMIT_SECONDS = 3600; // 1 hour

export async function POST(request: NextRequest) {
  // Parse and validate input
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
  const redis = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
  const rateLimitKey = `ratelimit:scan-once:${email.toLowerCase()}`;
  const existing = await redis.get(rateLimitKey);

  if (existing) {
    return NextResponse.json(
      {
        error: "Rate limited",
        message: "Maximum 1 scan per email per hour. Please try again later.",
      },
      { status: 429 },
    );
  }

  // Set rate limit
  await redis.set(rateLimitKey, 1, { ex: RATE_LIMIT_SECONDS });

  try {
    // Scan all public repos (no DeepSeek)
    const repos = await listPublicRepos(githubUsername);
    const allFindings: import("../../../src/types").Finding[] = [];

    for (const repo of repos) {
      try {
        const tree = await getRepoTree(githubUsername, repo.name, repo.default_branch);
        const files: Array<{ path: string; content: string }> = [];

        const BATCH_SIZE = 10;
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

    // Build report and send email
    const report = buildReport(githubUsername, repos.length, allFindings);

    // Save as subscriber
    await addSubscriber(githubUsername, email);

    const token = generateUnsubscribeToken(githubUsername);
    await sendReportEmail(report, email, token);

    return NextResponse.json({
      status: "complete",
      message: `Scan complete. ${allFindings.length} findings across ${repos.length} repositories. Report sent to ${email}.`,
      summary: {
        repos: repos.length,
        findings: allFindings.length,
      },
    });
  } catch (error) {
    console.error(`[scan-once] Error: ${String(error)}`);
    return NextResponse.json(
      { error: "Scan failed", message: String(error) },
      { status: 500 },
    );
  }
}
