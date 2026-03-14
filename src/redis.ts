import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// Central Redis client — supports both KV_REST_API_* and REDIS_URL env vars
// ---------------------------------------------------------------------------

let redis: Redis | null = null;

/**
 * Parse a redis(s):// URL into Upstash REST credentials.
 * Vercel Redis (powered by Upstash) provides REDIS_URL as:
 *   rediss://default:TOKEN@HOSTNAME:PORT
 * The Upstash REST API lives at https://HOSTNAME with the same TOKEN.
 *
 * @param redisUrl - Connection string from REDIS_URL
 * @returns Object with url and token for @upstash/redis
 */
function parseRedisUrl(redisUrl: string): { url: string; token: string } {
  const parsed = new URL(redisUrl);
  const token = parsed.password;
  const url = `https://${parsed.hostname}`;

  if (!token) {
    throw new Error(
      "REDIS_URL does not contain a password (expected rediss://default:TOKEN@HOST:PORT)",
    );
  }

  return { url, token };
}

export function getRedis(): Redis {
  if (redis) return redis;

  // Prefer explicit REST credentials (legacy KV_REST_API_* vars)
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
    return redis;
  }

  // Fall back to REDIS_URL from Vercel Redis integration
  if (process.env.REDIS_URL) {
    const { url, token } = parseRedisUrl(process.env.REDIS_URL);
    redis = new Redis({ url, token });
    return redis;
  }

  throw new Error(
    "Missing Redis configuration: set KV_REST_API_URL + KV_REST_API_TOKEN, or REDIS_URL",
  );
}
