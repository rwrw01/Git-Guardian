import type { ScanReport } from "./types";

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
