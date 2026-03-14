import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const Severity = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
} as const;
export type Severity = (typeof Severity)[keyof typeof Severity];

export const Category = {
  SECRET: "SECRET",
  DEPENDENCY: "DEPENDENCY",
  PII: "PII",
  CODE_PATTERN: "CODE_PATTERN",
} as const;
export type Category = (typeof Category)[keyof typeof Category];

// ---------------------------------------------------------------------------
// Finding
// ---------------------------------------------------------------------------

export interface Finding {
  severity: Severity;
  category: Category;
  repo: string;
  file: string;
  line: number;
  description: string;
  impact: string;
  fix: string;
  reference: string;
  /** Masked excerpt so the real secret/PII never appears in logs or reports */
  maskedValue?: string;
}

// ---------------------------------------------------------------------------
// Scan result wrapper
// ---------------------------------------------------------------------------

export type ScanResult =
  | { ok: true; findings: Finding[] }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Subscriber
// ---------------------------------------------------------------------------

export interface Subscriber {
  email: string;
  githubUsername: string;
  createdAt: string;
  lastScanAt: string | null;
  isOwner: boolean;
  deepseekEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Zod schemas — environment variables
// ---------------------------------------------------------------------------

export const EnvSchema = z.object({
  GITHUB_TOKEN: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  SCAN_EMAIL_FROM: z.string().email(),
  CRON_SECRET: z.string().min(1),
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

// ---------------------------------------------------------------------------
// Zod schemas — API input
// ---------------------------------------------------------------------------

export const ScanOnceInput = z.object({
  githubUsername: z
    .string()
    .min(1)
    .max(39)
    .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/),
  email: z.string().email(),
});

export type ScanOnceInput = z.infer<typeof ScanOnceInput>;

// ---------------------------------------------------------------------------
// GitHub API response types
// ---------------------------------------------------------------------------

export interface GitHubRepo {
  name: string;
  full_name: string;
  fork: boolean;
  size: number;
  default_branch: string;
}

export interface GitHubTreeEntry {
  path: string;
  type: "blob" | "tree";
  size?: number;
}

// ---------------------------------------------------------------------------
// OSV API types
// ---------------------------------------------------------------------------

export interface OsvQuery {
  package: { name: string; ecosystem: string };
  version?: string;
}

export interface OsvVulnerability {
  id: string;
  summary: string;
  severity?: Array<{ type: string; score: string }>;
  affected?: Array<{
    package: { name: string; ecosystem: string };
    ranges?: Array<{ events: Array<{ introduced?: string; fixed?: string }> }>;
  }>;
  references?: Array<{ type: string; url: string }>;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export interface ScanReport {
  githubUsername: string;
  scannedAt: string;
  totalRepos: number;
  findings: Finding[];
  maturity: {
    secrets: number;
    dependencies: number;
    pii: number;
  };
}
