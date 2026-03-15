#!/usr/bin/env node

/**
 * Post-build check: scan Next.js client bundles for leaked secrets.
 *
 * Vibecoding risk: AI tools sometimes put secrets in client-side code
 * (NEXT_PUBLIC_, inline values, etc.). This script catches that BEFORE deploy.
 *
 * Run: npx tsx scripts/check-secrets-in-bundle.ts
 * Or add to package.json: "postbuild": "tsx scripts/check-secrets-in-bundle.ts"
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BUILD_DIR = join(process.cwd(), ".next", "static");

// Patterns that should NEVER appear in client bundles
const FORBIDDEN_PATTERNS = [
  { name: "Azure Client Secret", regex: /client[_-]?secret["':\s=]+[A-Za-z0-9_~.]{30,}/gi },
  { name: "Azure Tenant ID", regex: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g },
  { name: "API Key (generic)", regex: /(?:sk[-_]live|sk[-_]test|sk[-_]ant|AKIA|AIza)[A-Za-z0-9_\-]{16,}/g },
  { name: "Private Key", regex: /-----BEGIN\s(?:RSA\s)?PRIVATE\sKEY-----/g },
  { name: "Database URL", regex: /(?:postgres|mysql|mongodb|redis):\/\/[^\s"']{10,}/gi },
  { name: "Connection String", regex: /DefaultEndpointsProtocol=https;AccountName=/g },
  { name: "JWT (hardcoded)", regex: /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\./g },
  { name: "process.env (server-only)", regex: /process\.env\.(?:GRAPH_|AUTH_SECRET|CRON_SECRET|RESEND_|REDIS_|DEEPSEEK_)/g },
];

function walkDir(dir: string): string[] {
  const files: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        files.push(...walkDir(full));
      } else if (full.endsWith(".js") || full.endsWith(".mjs")) {
        files.push(full);
      }
    }
  } catch {
    // Build dir may not exist yet
  }
  return files;
}

let violations = 0;

const files = walkDir(BUILD_DIR);
console.log(`Checking ${files.length} client bundle files for leaked secrets...\n`);

for (const file of files) {
  const content = readFileSync(file, "utf-8");
  const relPath = file.replace(process.cwd(), "");

  for (const pattern of FORBIDDEN_PATTERNS) {
    const matches = content.match(pattern.regex);
    if (matches) {
      for (const match of matches) {
        // Skip common false positives (short UUIDs in chunk hashes, etc.)
        if (match.length < 20 && pattern.name === "Azure Tenant ID") continue;

        console.error(
          `CRITICAL: ${pattern.name} found in client bundle!`,
        );
        console.error(`  File: ${relPath}`);
        console.error(`  Match: ${match.slice(0, 40)}...`);
        console.error();
        violations++;
      }
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} secret(s) found in client bundles! BUILD BLOCKED.`);
  console.error("Fix: move secrets to server-only code (API routes, server components).");
  console.error("Never use NEXT_PUBLIC_ for secrets, tokens, or credentials.\n");
  process.exit(1);
} else {
  console.log("No secrets found in client bundles. Build is safe.");
}
