import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// ---------------------------------------------------------------------------
// Magic-link email authentication — no external auth providers
// ---------------------------------------------------------------------------

const SESSION_COOKIE = "gg_session";
const SESSION_MAX_AGE = 8 * 60 * 60; // 8 hours
const MAGIC_LINK_TTL = 10 * 60; // 10 minutes

/**
 * Allowed admin email addresses — only these receive magic links and can
 * access the admin portal. Configured via ADMIN_EMAILS env var.
 */
function getAllowedEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET environment variable is required");
  return secret;
}

// ---------------------------------------------------------------------------
// Magic-link tokens (HMAC-based, time-limited)
// ---------------------------------------------------------------------------

export function generateMagicToken(email: string): { token: string; expiresAt: number } {
  const nonce = randomBytes(16).toString("hex");
  const expiresAt = Math.floor(Date.now() / 1000) + MAGIC_LINK_TTL;
  const payload = `${email.toLowerCase()}:${nonce}:${expiresAt}`;
  const signature = createHmac("sha256", getAuthSecret()).update(payload).digest("hex");
  const token = Buffer.from(`${payload}:${signature}`).toString("base64url");
  return { token, expiresAt };
}

export function verifyMagicToken(token: string): { valid: boolean; email: string } {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 4) return { valid: false, email: "" };

    const [email, nonce, expiresAtStr, signature] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);

    // Check expiry
    if (Math.floor(Date.now() / 1000) > expiresAt) {
      return { valid: false, email: "" };
    }

    // Timing-safe signature verification
    const payload = `${email}:${nonce}:${expiresAtStr}`;
    const expected = createHmac("sha256", getAuthSecret()).update(payload).digest("hex");
    const sigBuffer = Buffer.from(signature, "utf-8");
    const expectedBuffer = Buffer.from(expected, "utf-8");
    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      return { valid: false, email: "" };
    }

    // Check email is in allowlist
    if (!getAllowedEmails().includes(email)) {
      return { valid: false, email: "" };
    }

    return { valid: true, email };
  } catch {
    return { valid: false, email: "" };
  }
}

// ---------------------------------------------------------------------------
// Session management (signed cookie)
// ---------------------------------------------------------------------------

function signSession(email: string, expiresAt: number): string {
  const payload = `${email.toLowerCase()}:${expiresAt}`;
  const signature = createHmac("sha256", getAuthSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

function verifySession(sessionValue: string): { valid: boolean; email: string } {
  try {
    const decoded = Buffer.from(sessionValue, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return { valid: false, email: "" };

    const [email, expiresAtStr, signature] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);

    if (Math.floor(Date.now() / 1000) > expiresAt) {
      return { valid: false, email: "" };
    }

    const payload = `${email}:${expiresAtStr}`;
    const expected = createHmac("sha256", getAuthSecret()).update(payload).digest("hex");
    const sigBuffer = Buffer.from(signature, "utf-8");
    const expectedBuffer = Buffer.from(expected, "utf-8");
    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      return { valid: false, email: "" };
    }

    if (!getAllowedEmails().includes(email)) {
      return { valid: false, email: "" };
    }

    return { valid: true, email };
  } catch {
    return { valid: false, email: "" };
  }
}

/**
 * Create a session cookie for the given email address.
 */
export async function createSession(email: string): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const value = signSession(email, expiresAt);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

/**
 * Destroy the current session.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Get the current authenticated admin email, or null if not authenticated.
 * Re-validates the email against ADMIN_EMAILS on every call.
 */
export async function getSessionEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;
  if (!value) return null;

  const result = verifySession(value);
  return result.valid ? result.email : null;
}

/**
 * Require an authenticated admin session. Returns the email or throws.
 */
export async function requireAdmin(): Promise<string> {
  const email = await getSessionEmail();
  if (!email) throw new Error("Unauthorized");
  return email;
}

/**
 * Check if the given email is an allowed admin.
 */
export function isAllowedAdmin(email: string): boolean {
  return getAllowedEmails().includes(email.toLowerCase());
}
