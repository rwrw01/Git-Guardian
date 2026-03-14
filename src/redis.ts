import IORedis from "ioredis";

// ---------------------------------------------------------------------------
// Central Redis client — wraps ioredis with a simple key-value interface
// Supports REDIS_URL (Vercel Redis / Redis Labs) connection strings
// ---------------------------------------------------------------------------

let client: IORedis | null = null;

function getClient(): IORedis {
  if (client) return client;

  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("Missing REDIS_URL environment variable");
  }

  client = new IORedis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  return client;
}

// ---------------------------------------------------------------------------
// Simple wrapper that matches the interface used by subscribers, audit-log,
// and scan-store modules (previously @upstash/redis)
// ---------------------------------------------------------------------------

export const redis = {
  async get<T>(key: string): Promise<T | null> {
    const val = await getClient().get(key);
    if (val === null) return null;
    try {
      return JSON.parse(val) as T;
    } catch {
      return val as unknown as T;
    }
  },

  async set(
    key: string,
    value: unknown,
    options?: { ex?: number },
  ): Promise<void> {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    if (options?.ex) {
      await getClient().set(key, serialized, "EX", options.ex);
    } else {
      await getClient().set(key, serialized);
    }
  },

  async del(key: string): Promise<number> {
    return getClient().del(key);
  },

  async scan(
    cursor: string,
    options: { match: string; count: number },
  ): Promise<[string, string[]]> {
    const [nextCursor, keys] = await getClient().scan(
      Number(cursor),
      "MATCH",
      options.match,
      "COUNT",
      options.count,
    );
    return [String(nextCursor), keys];
  },

  async zadd(
    key: string,
    entry: { score: number; member: string },
  ): Promise<void> {
    await getClient().zadd(key, entry.score, entry.member);
  },

  async zrange<T>(
    key: string,
    start: number,
    stop: number,
    options?: { rev?: boolean },
  ): Promise<T> {
    let result: string[];
    if (options?.rev) {
      result = await getClient().zrevrange(key, start, stop);
    } else {
      result = await getClient().zrange(key, start, stop);
    }
    return result as unknown as T;
  },

  async zcard(key: string): Promise<number> {
    return getClient().zcard(key);
  },

  async zrem(key: string, member: string): Promise<number> {
    return getClient().zrem(key, member);
  },

  async dbsize(): Promise<number> {
    return getClient().dbsize();
  },

  async info(section?: string): Promise<string> {
    if (section) return getClient().info(section);
    return getClient().info();
  },
};

export function getRedis(): typeof redis {
  return redis;
}
