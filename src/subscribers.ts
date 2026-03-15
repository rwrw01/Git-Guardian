import type { Subscriber } from "./types";
import { createHmac } from "crypto";

import { getRedis } from "./redis";

// ---------------------------------------------------------------------------
// Subscriber datastore — Upstash Redis
// Key: subscriber:{github_username}
// ---------------------------------------------------------------------------

const PREFIX = "subscriber:";

function key(username: string): string {
  return `${PREFIX}${username.toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// Unsubscribe token — HMAC-signed so it can't be guessed
// ---------------------------------------------------------------------------

function getTokenSecret(): string {
  return process.env.CRON_SECRET ?? "fallback-secret";
}

export function generateUnsubscribeToken(username: string): string {
  return createHmac("sha256", getTokenSecret())
    .update(username.toLowerCase())
    .digest("hex");
}

export function verifyUnsubscribeToken(
  username: string,
  token: string,
): boolean {
  const expected = generateUnsubscribeToken(username);
  return expected === token;
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

export async function listSubscribers(): Promise<Subscriber[]> {
  const kv = getRedis();
  const keys: string[] = [];
  let cursor = "0";

  do {
    const result = await kv.scan(cursor, { match: `${PREFIX}*`, count: 100 });
    cursor = String(result[0]);
    keys.push(...result[1]);
  } while (cursor !== "0");

  if (keys.length === 0) return [];

  const subscribers: Subscriber[] = [];
  for (const k of keys) {
    const sub = await kv.get<Subscriber>(k);
    if (sub) subscribers.push(sub);
  }
  return subscribers;
}

export async function getSubscriber(
  username: string,
): Promise<Subscriber | null> {
  return getRedis().get<Subscriber>(key(username));
}

export async function addSubscriber(
  username: string,
  email: string,
  isOwner = false,
): Promise<Subscriber> {
  const kv = getRedis();
  const existing = await getSubscriber(username);
  if (existing) {
    const updated: Subscriber = { ...existing, email };
    await kv.set(key(username), updated);
    return updated;
  }

  const subscriber: Subscriber = {
    email,
    githubUsername: username,
    createdAt: new Date().toISOString(),
    lastScanAt: null,
    isOwner,
    deepseekEnabled: isOwner,
  };

  await kv.set(key(username), subscriber);
  return subscriber;
}

export async function removeSubscriber(username: string): Promise<boolean> {
  const deleted = await getRedis().del(key(username));
  return deleted > 0;
}

export async function updateLastScan(username: string): Promise<void> {
  const sub = await getSubscriber(username);
  if (!sub) return;
  await getRedis().set(key(username), {
    ...sub,
    lastScanAt: new Date().toISOString(),
  });
}

export async function updateSubscriberSettings(
  username: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const sub = await getSubscriber(username);
  if (!sub) return;
  await getRedis().set(key(username), { ...sub, ...updates });
}
