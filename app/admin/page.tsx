"use client";

import { useState, useEffect, useCallback } from "react";

interface HealthWarning {
  type: "redis" | "github";
  message: string;
}

interface DashboardData {
  subscribers: number;
  totalScans: number;
  recentFindings: Array<{
    severity: string;
    category: string;
    repo: string;
    file: string;
    description: string;
    maskedValue?: string;
  }>;
  severityCounts: { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number };
  lastScanId?: string;
  lastDeepseekAnalysis?: string | null;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [scanUsername, setScanUsername] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState("");
  const [useDeepseek, setUseDeepseek] = useState(true);
  const [scanProgress, setScanProgress] = useState("");
  const [warnings, setWarnings] = useState<HealthWarning[]>([]);

  const load = useCallback(async () => {
    const [subRes, scanRes] = await Promise.all([
      fetch("/api/admin/subscribers"),
      fetch("/api/admin/scans?limit=10"),
    ]);
    const subs = await subRes.json();
    const scans = await scanRes.json();

    const allFindings = scans.reports?.flatMap(
      (r: Record<string, unknown>) => (r.findings as Array<Record<string, string>>) ?? [],
    ) ?? [];

    const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const f of allFindings) {
      if (f.severity in severityCounts) {
        severityCounts[f.severity as keyof typeof severityCounts]++;
      }
    }

    // Get latest scan info
    const latestReport = scans.reports?.[0] as Record<string, unknown> | undefined;

    setData({
      subscribers: subs.count ?? 0,
      totalScans: scans.total ?? 0,
      recentFindings: allFindings.slice(0, 15),
      severityCounts,
      lastScanId: latestReport?.id as string | undefined,
      lastDeepseekAnalysis: latestReport?.deepseekAnalysis as string | null | undefined,
    });

    // Health checks
    try {
      const healthRes = await fetch("/api/admin/scans?health=true");
      const health = await healthRes.json();
      const w: HealthWarning[] = [];
      if (health.redisUsagePercent > 90) {
        w.push({ type: "redis", message: `Redis database is ${health.redisUsagePercent}% vol. Overweeg oude data op te ruimen.` });
      }
      if (health.githubRateRemaining < 100) {
        w.push({ type: "github", message: `GitHub API: ${health.githubRateRemaining}/${health.githubRateLimit} requests over. Reset over ${health.githubRateResetMin} min.` });
      }
      setWarnings(w);
    } catch { /* ignore health check errors */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function triggerScan() {
    if (!scanUsername.trim()) return;
    setScanning(true);
    setScanResult("");
    setScanProgress("Repositories ophalen...");

    // Progress simulation (scan takes 30-120s)
    const progressSteps = [
      { delay: 3000, msg: "Bestanden scannen op secrets..." },
      { delay: 10000, msg: "Dependency vulnerabilities checken (OSV.dev)..." },
      { delay: 20000, msg: "PII-detectie uitvoeren..." },
      { delay: 35000, msg: useDeepseek ? "DeepSeek AI-analyse draaien..." : "Rapport genereren..." },
      { delay: 60000, msg: "Rapport opslaan en e-mail versturen..." },
    ];
    const timers = progressSteps.map((step) =>
      setTimeout(() => { if (scanning) setScanProgress(step.msg); }, step.delay),
    );

    try {
      const res = await fetch("/api/admin/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubUsername: scanUsername,
          useDeepseek,
          sendEmail: true,
        }),
      });
      const result = await res.json();
      timers.forEach(clearTimeout);
      setScanProgress("");

      if (res.ok) {
        setScanResult(
          `Scan voltooid: ${result.findings} bevindingen in ${result.repos} repos` +
          (result.hasDeepseekAnalysis ? " (incl. AI-analyse)" : "") +
          ". Rapport verzonden per email."
        );
        await load();
      } else {
        setScanResult(`Fout: ${result.message ?? result.error}`);
      }
    } catch {
      timers.forEach(clearTimeout);
      setScanProgress("");
      setScanResult("Netwerkfout — de scan draait mogelijk nog op de server. Check Scan History voor resultaten.");
    }
    setScanning(false);
  }

  const SEVERITY_COLORS: Record<string, string> = {
    CRITICAL: "#f44747",
    HIGH: "#cd9731",
    MEDIUM: "#e2c08d",
    LOW: "#3794ff",
  };

  return (
    <div>
      <h1 style={{ fontSize: 20, color: "#cccccc", fontWeight: 400, marginBottom: 24 }}>
        Dashboard
      </h1>

      {/* Health warnings */}
      {warnings.map((w, i) => (
        <div
          key={i}
          style={{
            background: w.type === "redis" ? "#451a03" : "#172554",
            border: `1px solid ${w.type === "redis" ? "#92400e" : "#1e3a5f"}`,
            borderRadius: 4,
            padding: "10px 16px",
            marginBottom: 12,
            fontSize: 13,
            color: w.type === "redis" ? "#fbbf24" : "#93c5fd",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 16 }}>{w.type === "redis" ? "\u26A0" : "\u23F3"}</span>
          {w.message}
        </div>
      ))}

      {/* Stat cards */}
      <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Subscribers", value: data?.subscribers ?? "—" },
          { label: "Total Scans", value: data?.totalScans ?? "—" },
          { label: "Critical", value: data?.severityCounts.CRITICAL ?? "—", color: "#f44747" },
          { label: "High", value: data?.severityCounts.HIGH ?? "—", color: "#cd9731" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "#252526",
              border: "1px solid #3c3c3c",
              borderRadius: 4,
              padding: "16px 20px",
            }}
          >
            <div style={{ fontSize: 11, color: "#858585", textTransform: "uppercase", marginBottom: 4 }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 28, color: "color" in stat && stat.color ? stat.color : "#cccccc", fontWeight: 300 }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Manual scan */}
      <div
        style={{
          background: "#252526",
          border: "1px solid #3c3c3c",
          borderRadius: 4,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <h2 style={{ fontSize: 13, color: "#cccccc", fontWeight: 600, marginTop: 0, marginBottom: 12, textTransform: "uppercase" }}>
          Manual Scan
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={scanUsername}
            onChange={(e) => setScanUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && triggerScan()}
            placeholder="GitHub username"
            style={{
              flex: 1,
              padding: "6px 10px",
              fontSize: 13,
              background: "#3c3c3c",
              border: "1px solid #555",
              borderRadius: 2,
              color: "#cccccc",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={triggerScan}
            disabled={scanning}
            style={{
              padding: "6px 16px",
              fontSize: 13,
              background: scanning ? "#3c3c3c" : "#2ea043",
              color: "#fff",
              border: "none",
              borderRadius: 2,
              cursor: scanning ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {scanning ? "Scanning..." : "Run Scan"}
          </button>
        </div>
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ fontSize: 12, color: "#858585", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={useDeepseek}
              onChange={(e) => setUseDeepseek(e.target.checked)}
              style={{ accentColor: "#2ea043" }}
            />
            DeepSeek AI-analyse
          </label>
        </div>
        {/* Scan progress */}
        {scanning && scanProgress && (
          <div style={{
            marginTop: 8,
            fontSize: 12,
            color: "#e2c08d",
            padding: "8px 10px",
            background: "rgba(255,255,255,0.03)",
            borderRadius: 2,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <span style={{ display: "inline-block", animation: "spin 1s linear infinite", fontSize: 14 }}>{"\u23F3"}</span>
            {scanProgress}
          </div>
        )}
        {/* Scan result */}
        {scanResult && !scanning && (
          <div style={{
            marginTop: 8,
            fontSize: 12,
            color: scanResult.startsWith("Fout") ? "#f44747" : "#6a9955",
            padding: "8px 10px",
            background: "rgba(255,255,255,0.03)",
            borderRadius: 2,
          }}>
            {scanResult}
          </div>
        )}
      </div>

      {/* DeepSeek Analysis (if latest scan has one) */}
      {data?.lastDeepseekAnalysis && (
        <div
          style={{
            background: "#252526",
            border: "1px solid #3c3c3c",
            borderRadius: 4,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <h2 style={{ fontSize: 13, color: "#cccccc", fontWeight: 600, marginTop: 0, marginBottom: 12, textTransform: "uppercase" }}>
            Laatste AI-analyse (DeepSeek)
          </h2>
          <div style={{
            fontSize: 12,
            color: "#cccccc",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            maxHeight: 300,
            overflow: "auto",
            background: "#1e1e1e",
            padding: 12,
            borderRadius: 2,
          }}>
            {data.lastDeepseekAnalysis}
          </div>
        </div>
      )}

      {/* Recent findings */}
      <div
        style={{
          background: "#252526",
          border: "1px solid #3c3c3c",
          borderRadius: 4,
          padding: 20,
        }}
      >
        <h2 style={{ fontSize: 13, color: "#cccccc", fontWeight: 600, marginTop: 0, marginBottom: 12, textTransform: "uppercase" }}>
          Recent Findings
        </h2>
        {!data?.recentFindings.length ? (
          <p style={{ color: "#858585", fontSize: 13 }}>Nog geen bevindingen. Start een scan hierboven.</p>
        ) : (
          <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #3c3c3c", color: "#858585", textAlign: "left" }}>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Severity</th>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Type</th>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Repository</th>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Location</th>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {data.recentFindings.map((f, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #2d2d2d" }}>
                  <td style={{ padding: "6px 8px" }}>
                    <span style={{ color: SEVERITY_COLORS[f.severity] ?? "#ccc", fontWeight: 600, fontSize: 11 }}>
                      {f.severity}
                    </span>
                  </td>
                  <td style={{ padding: "6px 8px", color: "#9cdcfe" }}>{f.category}</td>
                  <td style={{ padding: "6px 8px", color: "#dcdcaa", fontFamily: "monospace", fontSize: 11 }}>
                    {f.repo.split("/")[1]}
                  </td>
                  <td style={{ padding: "6px 8px", color: "#ce9178", fontFamily: "monospace", fontSize: 11 }}>
                    {f.file}:{String((f as Record<string, unknown>).line ?? "")}
                  </td>
                  <td style={{ padding: "6px 8px", color: "#cccccc" }}>
                    {f.description}
                    {f.maskedValue && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: "#6b7280", fontFamily: "monospace" }}>
                        {f.maskedValue}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
