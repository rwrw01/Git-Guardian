import { getRedis } from "./redis";

// ---------------------------------------------------------------------------
// Audit log — immutable security event log stored in Upstash Redis
// ---------------------------------------------------------------------------

export interface AuditEntry {
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  details: string;
  ip?: string;
}

const AUDIT_PREFIX = "audit:";
const AUDIT_INDEX = "audit:index";

/**
 * Write an immutable audit log entry.
 * Each entry gets a unique key based on timestamp + random suffix.
 */
export async function logAudit(
  actor: string,
  action: string,
  target: string,
  details: string,
  ip?: string,
): Promise<void> {
  const kv = getRedis();
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    actor,
    action,
    target,
    details,
    ip,
  };

  const id = `${AUDIT_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await kv.set(id, entry);
  // Push ID to the sorted index for efficient retrieval
  await kv.zadd(AUDIT_INDEX, { score: Date.now(), member: id });
}

/**
 * Retrieve audit log entries, newest first.
 * Supports pagination via offset and limit.
 */
export async function getAuditLog(
  offset = 0,
  limit = 50,
): Promise<AuditEntry[]> {
  const kv = getRedis();
  // Get IDs from sorted set, newest first (reverse range)
  const ids = await kv.zrange<string[]>(AUDIT_INDEX, offset, offset + limit - 1, {
    rev: true,
  });

  if (ids.length === 0) return [];

  const entries: AuditEntry[] = [];
  for (const id of ids) {
    const entry = await kv.get<AuditEntry>(id);
    if (entry) entries.push(entry);
  }
  return entries;
}

/**
 * Count total audit log entries.
 */
export async function countAuditLog(): Promise<number> {
  return getRedis().zcard(AUDIT_INDEX);
}
