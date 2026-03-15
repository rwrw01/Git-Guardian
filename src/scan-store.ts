import type { ScanReport, Finding } from "./types";

import { getRedis } from "./redis";

// ---------------------------------------------------------------------------
// Scan history store — persists scan reports for the admin dashboard
// ---------------------------------------------------------------------------

const SCAN_PREFIX = "scan:";
const SCAN_INDEX = "scan:index";
const FP_PREFIX = "fp:"; // false positive markers

// ---------------------------------------------------------------------------
// Scan reports
// ---------------------------------------------------------------------------

export async function saveScanReport(report: ScanReport): Promise<string> {
  const kv = getRedis();
  const id = `${SCAN_PREFIX}${Date.now()}-${report.githubUsername}`;
  await kv.set(id, report, { ex: 90 * 24 * 60 * 60 }); // 90 days retention
  await kv.zadd(SCAN_INDEX, { score: Date.now(), member: id });
  return id;
}

export async function getScanReports(
  offset = 0,
  limit = 20,
): Promise<Array<ScanReport & { id: string }>> {
  const kv = getRedis();
  const ids = await kv.zrange<string[]>(SCAN_INDEX, offset, offset + limit - 1, {
    rev: true,
  });

  if (ids.length === 0) return [];

  const reports: Array<ScanReport & { id: string }> = [];
  for (const id of ids) {
    const report = await kv.get<ScanReport>(id);
    if (report) reports.push({ ...report, id });
  }
  return reports;
}

export async function getScanReport(
  id: string,
): Promise<ScanReport | null> {
  return getRedis().get<ScanReport>(id);
}

export async function countScanReports(): Promise<number> {
  return getRedis().zcard(SCAN_INDEX);
}

// ---------------------------------------------------------------------------
// False positive management
// ---------------------------------------------------------------------------

export interface FalsePositive {
  findingHash: string;
  repo: string;
  file: string;
  pattern: string;
  markedBy: string;
  markedAt: string;
  reason: string;
}

/**
 * Create a unique hash for a finding to identify false positives.
 */
export function findingHash(repo: string, file: string, description: string): string {
  // Simple hash: deterministic string from finding identity
  return Buffer.from(`${repo}:${file}:${description}`).toString("base64url").slice(0, 32);
}

export async function markFalsePositive(fp: FalsePositive): Promise<void> {
  const kv = getRedis();
  await kv.set(`${FP_PREFIX}${fp.findingHash}`, fp);
}

export async function unmarkFalsePositive(hash: string): Promise<void> {
  await getRedis().del(`${FP_PREFIX}${hash}`);
}

export async function isFalsePositive(hash: string): Promise<boolean> {
  const result = await getRedis().get(`${FP_PREFIX}${hash}`);
  return result !== null;
}

/**
 * Filter out findings that have been marked as false positive.
 */
export async function filterFalsePositives(findings: Finding[]): Promise<Finding[]> {
  if (findings.length === 0) return findings;

  const results: Finding[] = [];
  for (const f of findings) {
    const hash = findingHash(f.repo, f.file, f.description);
    const fp = await isFalsePositive(hash);
    if (!fp) results.push(f);
  }
  return results;
}

export async function listFalsePositives(): Promise<FalsePositive[]> {
  const kv = getRedis();
  const keys: string[] = [];
  let cursor = "0";

  do {
    const result = await kv.scan(cursor, { match: `${FP_PREFIX}*`, count: 100 });
    cursor = String(result[0]);
    keys.push(...result[1]);
  } while (cursor !== "0");

  const fps: FalsePositive[] = [];
  for (const k of keys) {
    const fp = await kv.get<FalsePositive>(k);
    if (fp) fps.push(fp);
  }
  return fps;
}

// ---------------------------------------------------------------------------
// Delta reporting — track known findings per user
// ---------------------------------------------------------------------------

const KNOWN_PREFIX = "known-findings:";

/**
 * Generate a fingerprint for a finding (deterministic, same finding = same hash).
 */
export function findingFingerprint(f: Finding): string {
  return Buffer.from(`${f.repo}:${f.file}:${f.line}:${f.category}:${f.description}`)
    .toString("base64url")
    .slice(0, 40);
}

/**
 * Get the set of known finding fingerprints for a user.
 */
export async function getKnownFindings(username: string): Promise<Set<string>> {
  const kv = getRedis();
  const data = await kv.get<string[]>(`${KNOWN_PREFIX}${username.toLowerCase()}`);
  return new Set(data ?? []);
}

/**
 * Save the current set of finding fingerprints for a user.
 */
export async function saveKnownFindings(
  username: string,
  findings: Finding[],
): Promise<void> {
  const kv = getRedis();
  const fingerprints = findings.map(findingFingerprint);
  await kv.set(`${KNOWN_PREFIX}${username.toLowerCase()}`, fingerprints);
}

/**
 * Split findings into new and previously known.
 */
export async function classifyFindings(
  username: string,
  findings: Finding[],
): Promise<{ newFindings: Finding[]; knownFindings: Finding[] }> {
  const known = await getKnownFindings(username);
  const newFindings: Finding[] = [];
  const knownFindings: Finding[] = [];

  for (const f of findings) {
    if (known.has(findingFingerprint(f))) {
      knownFindings.push(f);
    } else {
      newFindings.push(f);
    }
  }

  return { newFindings, knownFindings };
}

// ---------------------------------------------------------------------------
// Scan configuration
// ---------------------------------------------------------------------------

const CONFIG_PREFIX = "config:";

export async function getConfig<T>(key: string, defaultValue: T): Promise<T> {
  const kv = getRedis();
  const val = await kv.get<T>(`${CONFIG_PREFIX}${key}`);
  return val ?? defaultValue;
}

export async function setConfig(key: string, value: unknown): Promise<void> {
  const kv = getRedis();
  await kv.set(`${CONFIG_PREFIX}${key}`, value);
}
