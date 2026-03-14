import { Severity } from "./types";

// ---------------------------------------------------------------------------
// Secret patterns — based on TruffleHog, Gitleaks, Secrets Patterns DB
// ---------------------------------------------------------------------------

export interface SecretPattern {
  id: string;
  description: string;
  regex: RegExp;
  severity: Severity;
}

export const SECRET_PATTERNS: SecretPattern[] = [
  // AWS
  {
    id: "aws-access-key",
    description: "AWS Access Key ID",
    regex: /AKIA[0-9A-Z]{16}/,
    severity: Severity.CRITICAL,
  },
  {
    id: "aws-secret-key",
    description: "AWS Secret Access Key",
    regex: /(?:aws_secret_access_key|aws_secret)\s*[:=]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/i,
    severity: Severity.CRITICAL,
  },

  // GitHub
  {
    id: "github-token",
    description: "GitHub Token",
    regex: /gh[pousr]_[A-Za-z0-9_]{36,255}/,
    severity: Severity.CRITICAL,
  },
  {
    id: "github-fine-grained",
    description: "GitHub Fine-Grained PAT",
    regex: /github_pat_[A-Za-z0-9_]{22,255}/,
    severity: Severity.CRITICAL,
  },

  // Google
  {
    id: "google-api-key",
    description: "Google API Key",
    regex: /AIza[0-9A-Za-z\-_]{35}/,
    severity: Severity.HIGH,
  },

  // Stripe
  {
    id: "stripe-secret-key",
    description: "Stripe Secret Key",
    regex: /sk_live_[0-9a-zA-Z]{24,99}/,
    severity: Severity.CRITICAL,
  },
  {
    id: "stripe-publishable-key",
    description: "Stripe Publishable Key",
    regex: /pk_live_[0-9a-zA-Z]{24,99}/,
    severity: Severity.LOW,
  },

  // Slack
  {
    id: "slack-token",
    description: "Slack Token",
    regex: /xox[bpors]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,34}/,
    severity: Severity.CRITICAL,
  },
  {
    id: "slack-webhook",
    description: "Slack Webhook URL",
    regex: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]{8,}\/B[A-Z0-9]{8,}\/[a-zA-Z0-9]{24,}/,
    severity: Severity.HIGH,
  },

  // Private keys
  {
    id: "private-key",
    description: "Private Key",
    regex: /-----BEGIN\s(?:RSA\s|EC\s|DSA\s|OPENSSH\s)?PRIVATE\sKEY-----/,
    severity: Severity.CRITICAL,
  },

  // JWT
  {
    id: "jwt",
    description: "JSON Web Token",
    regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
    severity: Severity.HIGH,
  },

  // Generic secrets
  {
    id: "generic-api-key",
    description: "Generic API Key",
    regex: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?([A-Za-z0-9_\-]{20,})['"]?/i,
    severity: Severity.MEDIUM,
  },
  {
    id: "generic-secret",
    description: "Generic Secret/Password/Token",
    regex: /(?:secret|password|passwd|token|credential)\s*[:=]\s*['"]?([A-Za-z0-9_\-!@#$%^&*]{8,})['"]?/i,
    severity: Severity.MEDIUM,
  },

  // Database URLs
  {
    id: "database-url",
    description: "Database Connection String",
    regex: /(?:mysql|postgres|postgresql|mongodb|redis|amqp):\/\/[^\s'"]{10,}/i,
    severity: Severity.CRITICAL,
  },

  // SendGrid
  {
    id: "sendgrid-api-key",
    description: "SendGrid API Key",
    regex: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/,
    severity: Severity.HIGH,
  },

  // Twilio
  {
    id: "twilio-api-key",
    description: "Twilio API Key",
    regex: /SK[0-9a-fA-F]{32}/,
    severity: Severity.HIGH,
  },

  // Mailchimp
  {
    id: "mailchimp-api-key",
    description: "Mailchimp API Key",
    regex: /[0-9a-f]{32}-us\d{1,2}/,
    severity: Severity.MEDIUM,
  },

  // Heroku
  {
    id: "heroku-api-key",
    description: "Heroku API Key",
    regex: /(?:heroku.*api[_-]?key)\s*[:=]\s*['"]?([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})['"]?/i,
    severity: Severity.HIGH,
  },

  // npm token
  {
    id: "npm-token",
    description: "npm Access Token",
    regex: /npm_[A-Za-z0-9]{36}/,
    severity: Severity.CRITICAL,
  },
];

// ---------------------------------------------------------------------------
// PII patterns — Dutch-specific, based on Presidio
// ---------------------------------------------------------------------------

export interface PiiPattern {
  id: string;
  description: string;
  regex: RegExp;
  severity: Severity;
  /** Optional validator for checksum-based verification */
  validate?: (match: string) => boolean;
}

/**
 * BSN 11-check (Elfproef): multiply digits 1-8 by 9-2, digit 9 by -1,
 * sum must be divisible by 11 and not zero.
 */
function validateBsn(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 9) return false;
  const weights = [9, 8, 7, 6, 5, 4, 3, 2, -1];
  const sum = digits
    .split("")
    .reduce((acc, d, i) => acc + parseInt(d, 10) * weights[i], 0);
  return sum !== 0 && sum % 11 === 0;
}

/**
 * IBAN mod-97 check: move first 4 chars to end, replace letters with
 * numbers (A=10..Z=35), remainder of division by 97 must be 1.
 */
function validateIban(value: string): boolean {
  const cleaned = value.replace(/\s/g, "").toUpperCase();
  if (cleaned.length < 15 || cleaned.length > 34) return false;
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) =>
    String(ch.charCodeAt(0) - 55),
  );
  let remainder = 0;
  for (const char of numeric) {
    remainder = (remainder * 10 + parseInt(char, 10)) % 97;
  }
  return remainder === 1;
}

export const PII_PATTERNS: PiiPattern[] = [
  {
    id: "bsn",
    description: "BSN (Burgerservicenummer)",
    regex: /\b[0-9]{9}\b/,
    severity: Severity.CRITICAL,
    validate: validateBsn,
  },
  {
    id: "iban-nl",
    description: "Dutch IBAN",
    regex: /\bNL\d{2}[A-Z]{4}\d{10}\b/,
    severity: Severity.CRITICAL,
    validate: validateIban,
  },
  {
    id: "iban-generic",
    description: "IBAN (non-NL)",
    regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7,27}\b/,
    severity: Severity.HIGH,
    validate: validateIban,
  },
  {
    id: "email",
    description: "Email Address",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    severity: Severity.MEDIUM,
  },
  {
    id: "phone-nl",
    description: "Dutch Phone Number",
    regex: /(?:\+31|0)[1-9]\d{8}\b/,
    severity: Severity.MEDIUM,
  },
  {
    id: "kvk",
    description: "KvK Number",
    regex: /\b[0-9]{8}\b/,
    severity: Severity.MEDIUM,
    // KvK is 8-digit; only flag when near keywords to reduce false positives
  },
  {
    id: "postcode-nl",
    description: "Dutch Postal Code",
    regex: /\b[1-9]\d{3}\s?[A-Z]{2}\b/,
    severity: Severity.LOW,
  },
];

// ---------------------------------------------------------------------------
// Files to skip
// ---------------------------------------------------------------------------

export const SKIP_FILE_PATTERNS = [
  /node_modules\//,
  /\.git\//,
  /vendor\//,
  /dist\//,
  /build\//,
  /\.min\.(js|css)$/,
  /\.(png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot|mp[34]|avi|mov|zip|tar|gz|pdf)$/i,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
];

export const SKIP_SECRET_FILE_PATTERNS = [
  /\.env\.example$/,
  /\.env\.sample$/,
  /\.env\.template$/,
];

/** Context patterns that indicate test/example data — skip PII matches here */
export const PII_SKIP_CONTEXT = [
  /voorbeeld/i,
  /example/i,
  /test/i,
  /mock/i,
  /dummy/i,
  /placeholder/i,
  /fake/i,
];

/** KvK keyword context — only flag 8-digit numbers near these keywords */
export const KVK_KEYWORDS = [/kvk/i, /kamer\s*van\s*koophandel/i, /chamber/i];

// ---------------------------------------------------------------------------
// Placeholder & false positive detection
// ---------------------------------------------------------------------------

/**
 * Placeholder email domains — addresses at these domains are never real PII.
 * Based on RFC 2606 reserved domains + common documentation patterns.
 */
export const PLACEHOLDER_EMAIL_DOMAINS = [
  "example.com",
  "example.org",
  "example.net",
  "yourdomain.com",
  "yourdomain.nl",
  "your-domain.com",
  "domain.com",
  "domain.nl",
  "email.com",
  "company.com",
  "organization.org",
  "test.com",
  "test.local",
  "localhost",
  "invalid",
  "saa.local",
];

/**
 * Detect if a string is a placeholder/example value rather than a real secret.
 * Checks for: repeated characters, sequential patterns, x-fill, obvious dummies.
 * Inspired by TruffleHog's allowlist and Yelp detect-secrets' filters.
 */
export function isPlaceholderValue(value: string): boolean {
  const lower = value.toLowerCase();

  // Repeated single character: aaaaaaa, xxxxxxx, 0000000
  if (/^(.)\1{5,}$/.test(lower)) return true;

  // Mostly x's or *'s (placeholder fill): ghp_xxxxxxxxxxxx, ****
  const xCount = (lower.match(/x/g) ?? []).length;
  if (value.length > 6 && xCount / value.length > 0.5) return true;
  if (/\*{3,}/.test(value)) return true;

  // Common placeholder words
  const placeholders = [
    "your-",
    "your_",
    "replace",
    "insert",
    "changeme",
    "fixme",
    "todo",
    "placeholder",
    "dummy",
    "fake",
    "sample",
    "example",
    "test-",
    "test_",
  ];
  if (placeholders.some((p) => lower.includes(p))) return true;

  // "here" suffix pattern: "put-your-token-here", "openai-key-here"
  if (lower.endsWith("here")) return true;

  // Stripe/service test keys (sk_test_, pk_test_)
  if (/^[sp]k_test_/i.test(value)) return true;

  // AWS test key pattern
  if (value === "AKIA00000000000000000" || /^AKIA0{16}$/.test(value)) return true;

  return false;
}

/**
 * Detect if a line is inside a markdown code block example or documentation
 * context that typically contains placeholder values.
 */
export function isDocumentationContext(
  lines: string[],
  lineIndex: number,
  filePath: string,
): boolean {
  // Markdown files: check if inside a fenced code block (```...```)
  if (/\.(md|mdx)$/i.test(filePath)) {
    let inCodeBlock = false;
    for (let i = 0; i <= lineIndex; i++) {
      if (/^```/.test(lines[i].trim())) {
        inCodeBlock = !inCodeBlock;
      }
    }
    if (inCodeBlock) return true;
  }

  // Lines with "e.g.", "for example", "such as" are documentation
  const line = lines[lineIndex];
  if (/\b(e\.g\.|for example|such as|bijv\.|zoals)\b/i.test(line)) return true;

  // Comment lines with example indicators
  if (/^\s*(#|\/\/)\s*(example|voorbeeld|e\.g\.|sample)/i.test(line)) return true;

  return false;
}

/**
 * Check if an email address is a placeholder/example.
 */
export function isPlaceholderEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return PLACEHOLDER_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

// ---------------------------------------------------------------------------
// Max file size for scanning (1 MB)
// ---------------------------------------------------------------------------

export const MAX_FILE_SIZE = 1_048_576;
