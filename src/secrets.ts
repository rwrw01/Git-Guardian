import type { Finding, ScanResult } from "./types";
import { Severity, Category } from "./types";
import { SECRET_PATTERNS, SKIP_SECRET_FILE_PATTERNS } from "./patterns";

// ---------------------------------------------------------------------------
// Shannon entropy
// ---------------------------------------------------------------------------

function shannonEntropy(s: string): number {
  const freq = new Map<string, number>();
  for (const ch of s) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / s.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

// ---------------------------------------------------------------------------
// Mask a secret value for safe logging
// ---------------------------------------------------------------------------

function mask(value: string): string {
  if (value.length <= 8) return "****";
  return value.slice(0, 4) + "****" + value.slice(-4);
}

// ---------------------------------------------------------------------------
// Scan a single file's content for secrets
// ---------------------------------------------------------------------------

export function scanFileForSecrets(
  content: string,
  repo: string,
  filePath: string,
): Finding[] {
  // Skip known example/template files
  if (SKIP_SECRET_FILE_PATTERNS.some((p) => p.test(filePath))) return [];

  const findings: Finding[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const pattern of SECRET_PATTERNS) {
      const match = pattern.regex.exec(line);
      if (!match) continue;

      const matchedValue = match[1] ?? match[0];

      // For generic patterns, require minimum entropy to reduce false positives
      if (
        (pattern.id === "generic-api-key" || pattern.id === "generic-secret") &&
        shannonEntropy(matchedValue) < 3.5
      ) {
        continue;
      }

      findings.push({
        severity: pattern.severity,
        category: Category.SECRET,
        repo,
        file: filePath,
        line: i + 1,
        description: `${pattern.description} detected`,
        impact: `Exposed ${pattern.description.toLowerCase()} could allow unauthorized access`,
        fix: `Remove the secret from source code and rotate it immediately`,
        reference: `https://cwe.mitre.org/data/definitions/798.html`,
        maskedValue: mask(matchedValue),
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Scan all files for a repo (entry point)
// ---------------------------------------------------------------------------

export function scanForSecrets(
  files: Array<{ path: string; content: string }>,
  repo: string,
): ScanResult {
  try {
    const findings: Finding[] = [];
    for (const file of files) {
      findings.push(...scanFileForSecrets(file.content, repo, file.path));
    }
    return { ok: true, findings };
  } catch (error) {
    return { ok: false, error: `Secret scan failed: ${String(error)}` };
  }
}
