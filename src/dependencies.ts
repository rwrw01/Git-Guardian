import type { Finding, ScanResult, OsvQuery, OsvVulnerability } from "./types";
import { Severity, Category } from "./types";

// ---------------------------------------------------------------------------
// Manifest parsers — extract package name + version from lockfiles/manifests
// ---------------------------------------------------------------------------

interface Dependency {
  name: string;
  version: string;
  ecosystem: string;
}

function parsePackageJson(content: string): Dependency[] {
  try {
    const pkg = JSON.parse(content);
    const deps: Dependency[] = [];
    for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
      deps.push({ name, version: String(version).replace(/^[\^~>=<]+/, ""), ecosystem: "npm" });
    }
    for (const [name, version] of Object.entries(pkg.devDependencies ?? {})) {
      deps.push({ name, version: String(version).replace(/^[\^~>=<]+/, ""), ecosystem: "npm" });
    }
    return deps;
  } catch {
    return [];
  }
}

function parseRequirementsTxt(content: string): Dependency[] {
  return content
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#") && !l.startsWith("-"))
    .map((l) => {
      const match = l.match(/^([A-Za-z0-9_.-]+)\s*[=~!><]=?\s*([0-9][^\s;,]*)/);
      if (!match) return null;
      return { name: match[1], version: match[2], ecosystem: "PyPI" };
    })
    .filter((d): d is Dependency => d !== null);
}

function parseGoSum(content: string): Dependency[] {
  const seen = new Set<string>();
  return content
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      const parts = l.split(/\s+/);
      if (parts.length < 2) return null;
      const name = parts[0];
      const version = parts[1].replace("/go.mod", "").replace("v", "");
      const key = `${name}@${version}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return { name, version, ecosystem: "Go" };
    })
    .filter((d): d is Dependency => d !== null);
}

// ---------------------------------------------------------------------------
// Detect manifest files and extract dependencies
// ---------------------------------------------------------------------------

const MANIFEST_PARSERS: Record<string, (content: string) => Dependency[]> = {
  "package.json": parsePackageJson,
  "requirements.txt": parseRequirementsTxt,
  "go.sum": parseGoSum,
};

export function extractDependencies(
  files: Array<{ path: string; content: string }>,
): Dependency[] {
  const deps: Dependency[] = [];
  for (const file of files) {
    const filename = file.path.split("/").pop() ?? "";
    const parser = MANIFEST_PARSERS[filename];
    if (parser) {
      deps.push(...parser(file.content));
    }
  }
  return deps;
}

// ---------------------------------------------------------------------------
// Query OSV.dev API
// ---------------------------------------------------------------------------

const OSV_API = "https://api.osv.dev/v1/querybatch";

async function fetchVulnDetails(id: string): Promise<OsvVulnerability | null> {
  try {
    const res = await fetch(`https://api.osv.dev/v1/vulns/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as OsvVulnerability;
  } catch {
    return null;
  }
}

export async function queryOsv(
  deps: Dependency[],
): Promise<Map<string, OsvVulnerability[]>> {
  if (deps.length === 0) return new Map();

  const queries: { queries: OsvQuery[] } = {
    queries: deps.map((d) => ({
      package: { name: d.name, ecosystem: d.ecosystem },
      version: d.version,
    })),
  };

  const res = await fetch(OSV_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(queries),
  });

  if (!res.ok) {
    throw new Error(`OSV API ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { results: Array<{ vulns?: Array<{ id: string }> }> };
  const vulnMap = new Map<string, OsvVulnerability[]>();

  // Batch endpoint returns only IDs — fetch full details per vuln
  for (let i = 0; i < deps.length; i++) {
    const vulnRefs = data.results[i]?.vulns;
    if (!vulnRefs || vulnRefs.length === 0) continue;

    const details = await Promise.all(
      vulnRefs.map((v) => fetchVulnDetails(v.id)),
    );

    const vulns = details.filter((v): v is OsvVulnerability => v !== null);
    if (vulns.length > 0) {
      vulnMap.set(`${deps[i].ecosystem}:${deps[i].name}@${deps[i].version}`, vulns);
    }
  }

  return vulnMap;
}

// ---------------------------------------------------------------------------
// Convert vulnerabilities to findings
// ---------------------------------------------------------------------------

function osvSeverity(vuln: OsvVulnerability): Severity {
  const score = vuln.severity?.[0]?.score;
  if (!score) return Severity.MEDIUM;

  // OSV returns CVSS vector string like "CVSS:3.1/AV:N/AC:L/..." or a numeric score
  const numericMatch = score.match(/(\d+\.?\d*)/);
  if (!numericMatch) return Severity.MEDIUM;

  // If it's a CVSS vector, extract base score from database_specific or parse vector
  // For CVSS vectors, use the database_specific score if available
  const cvss = parseFloat(numericMatch[1]);
  // CVSS vectors start with version (3.1), not the actual score
  if (score.startsWith("CVSS:")) {
    // Extract severity from vector: look for high-impact indicators
    const hasNetworkAccess = score.includes("/AV:N");
    const lowComplexity = score.includes("/AC:L");
    const highImpact = score.includes("/I:H") || score.includes("/A:H") || score.includes("/C:H");

    if (hasNetworkAccess && lowComplexity && highImpact) return Severity.CRITICAL;
    if (hasNetworkAccess && highImpact) return Severity.HIGH;
    if (highImpact) return Severity.MEDIUM;
    return Severity.LOW;
  }

  if (cvss >= 9.0) return Severity.CRITICAL;
  if (cvss >= 7.0) return Severity.HIGH;
  if (cvss >= 4.0) return Severity.MEDIUM;
  return Severity.LOW;
}

function fixVersion(vuln: OsvVulnerability): string {
  const fixed = vuln.affected?.[0]?.ranges?.[0]?.events?.find((e) => e.fixed);
  return fixed?.fixed ?? "No fix available";
}

// ---------------------------------------------------------------------------
// Scan entry point
// ---------------------------------------------------------------------------

export async function scanForDependencyVulns(
  files: Array<{ path: string; content: string }>,
  repo: string,
): Promise<ScanResult> {
  try {
    const deps = extractDependencies(files);
    if (deps.length === 0) return { ok: true, findings: [] };

    const vulnMap = await queryOsv(deps);
    const findings: Finding[] = [];

    for (const [pkgKey, vulns] of vulnMap) {
      for (const vuln of vulns) {
        const sev = osvSeverity(vuln);
        // Only report CRITICAL and HIGH
        if (sev !== Severity.CRITICAL && sev !== Severity.HIGH) continue;

        const manifestFile = files.find((f) => {
          const filename = f.path.split("/").pop() ?? "";
          return filename in MANIFEST_PARSERS;
        });

        findings.push({
          severity: sev,
          category: Category.DEPENDENCY,
          repo,
          file: manifestFile?.path ?? "unknown",
          line: 0,
          description: `${vuln.id}: ${vuln.summary ?? "No description"}`,
          impact: `Vulnerable dependency ${pkgKey}`,
          fix: `Update to version ${fixVersion(vuln)}`,
          reference: vuln.references?.[0]?.url ?? `https://osv.dev/vulnerability/${vuln.id}`,
        });
      }
    }

    return { ok: true, findings };
  } catch (error) {
    return { ok: false, error: `Dependency scan failed: ${String(error)}` };
  }
}
