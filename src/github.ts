import type { GitHubRepo, GitHubTreeEntry } from "./types";
import { SKIP_FILE_PATTERNS, MAX_FILE_SIZE } from "./patterns";

// ---------------------------------------------------------------------------
// GitHub REST API helpers
// ---------------------------------------------------------------------------

const GITHUB_API = "https://api.github.com";

function headers(): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Git-Guardian/0.1",
  };
  if (process.env.GITHUB_TOKEN) {
    h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return h;
}

async function ghFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: headers() });

  const remaining = res.headers.get("x-ratelimit-remaining");
  const resetAt = res.headers.get("x-ratelimit-reset");

  if (remaining) {
    const left = parseInt(remaining, 10);
    if (left < 50) {
      console.warn(`[github] Rate limit low: ${left} remaining`);
    }
    // Auto-throttle: if nearly exhausted, wait until reset
    if (left < 10 && resetAt) {
      const waitMs = Math.max(0, parseInt(resetAt, 10) * 1000 - Date.now()) + 1000;
      if (waitMs < 120_000) {
        console.warn(`[github] Rate limit near zero, waiting ${Math.round(waitMs / 1000)}s for reset`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }

  // Handle 403 rate limit: wait and retry, or report reset time
  if (res.status === 403 && resetAt) {
    const resetTime = parseInt(resetAt, 10) * 1000;
    const waitMs = Math.max(0, resetTime - Date.now()) + 1000;
    const waitMin = Math.ceil(waitMs / 60_000);

    // For admin scans: wait up to 15 minutes
    if (waitMs < 900_000) {
      console.warn(`[github] 403 rate limited on ${path}, waiting ${waitMin} min for reset`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      const retry = await fetch(`${GITHUB_API}${path}`, { headers: headers() });
      if (!retry.ok) {
        const body = await retry.text().catch(() => "");
        throw new Error(`GitHub API ${retry.status}: ${path} — ${body}`);
      }
      return retry.json() as Promise<T>;
    }

    // Too long to wait — give clear error with reset time
    const resetDate = new Date(resetTime);
    const resetStr = resetDate.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" });
    throw new Error(`GitHub API rate limit bereikt. Reset om ${resetStr} (over ${waitMin} min). Probeer het later opnieuw.`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status}: ${path} — ${body}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * List all public, non-fork repositories for a user.
 * Handles pagination (max 100 per page).
 */
export async function listPublicRepos(username: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const batch = await ghFetch<GitHubRepo[]>(
      `/users/${encodeURIComponent(username)}/repos?type=public&per_page=${perPage}&page=${page}`,
    );
    repos.push(...batch.filter((r) => !r.fork));
    if (batch.length < perPage) break;
    page++;
  }

  return repos;
}

/**
 * Get the full recursive file tree for a repo's default branch.
 * Returns only blob entries that pass the skip-file filter and size limit.
 */
export async function getRepoTree(
  owner: string,
  repo: string,
  branch: string,
): Promise<GitHubTreeEntry[]> {
  const data = await ghFetch<{ tree: GitHubTreeEntry[]; truncated: boolean }>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
  );

  if (data.truncated) {
    console.warn(`[github] Tree truncated for ${owner}/${repo}`);
  }

  return data.tree.filter((entry) => {
    if (entry.type !== "blob") return false;
    if (entry.size && entry.size > MAX_FILE_SIZE) return false;
    return !SKIP_FILE_PATTERNS.some((p) => p.test(entry.path));
  });
}

/**
 * Fetch the text content of a single file.
 * Returns null if the file is binary or too large.
 */
export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
): Promise<string | null> {
  const data = await ghFetch<{ content?: string; encoding?: string; size: number }>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`,
  );

  if (!data.content || data.encoding !== "base64") return null;
  if (data.size > MAX_FILE_SIZE) return null;

  return Buffer.from(data.content, "base64").toString("utf-8");
}
