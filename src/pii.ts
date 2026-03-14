import type { Finding, ScanResult } from "./types";
import { Category } from "./types";
import { PII_PATTERNS, PII_SKIP_CONTEXT, KVK_KEYWORDS } from "./patterns";

// ---------------------------------------------------------------------------
// Scan a single file for PII
// ---------------------------------------------------------------------------

export function scanFileForPii(
  content: string,
  repo: string,
  filePath: string,
): Finding[] {
  // Skip test/mock/example files entirely
  if (/\/(test|__tests__|__mocks__|fixtures|mock|fake)\//i.test(filePath)) {
    return [];
  }

  const findings: Finding[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip lines that are clearly example/test context
    if (PII_SKIP_CONTEXT.some((p) => p.test(line))) continue;

    for (const pattern of PII_PATTERNS) {
      const match = pattern.regex.exec(line);
      if (!match) continue;

      const matchedValue = match[0];

      // Run checksum validation if available
      if (pattern.validate && !pattern.validate(matchedValue)) continue;

      // KvK: only flag when near keywords (too many false positives otherwise)
      if (pattern.id === "kvk") {
        // Check current line and surrounding lines for KvK keywords
        const context = [lines[i - 1], line, lines[i + 1]]
          .filter(Boolean)
          .join(" ");
        if (!KVK_KEYWORDS.some((kw) => kw.test(context))) continue;
      }

      findings.push({
        severity: pattern.severity,
        category: Category.PII,
        repo,
        file: filePath,
        line: i + 1,
        description: `${pattern.description} detected`,
        impact: `Exposed ${pattern.description.toLowerCase()} is a privacy violation (GDPR/AVG)`,
        fix: `Remove PII from source code. Use environment variables or a secrets manager.`,
        reference: "https://cwe.mitre.org/data/definitions/359.html",
        maskedValue: maskPii(matchedValue),
      });
    }
  }

  return findings;
}

function maskPii(value: string): string {
  if (value.includes("@")) {
    // Email: show first char + domain
    const [local, domain] = value.split("@");
    return local[0] + "****@" + domain;
  }
  if (value.length <= 6) return "****";
  return value.slice(0, 2) + "****" + value.slice(-2);
}

// ---------------------------------------------------------------------------
// Scan all files for PII (entry point)
// ---------------------------------------------------------------------------

export function scanForPii(
  files: Array<{ path: string; content: string }>,
  repo: string,
): ScanResult {
  try {
    const findings: Finding[] = [];
    for (const file of files) {
      findings.push(...scanFileForPii(file.content, repo, file.path));
    }
    return { ok: true, findings };
  } catch (error) {
    return { ok: false, error: `PII scan failed: ${String(error)}` };
  }
}
