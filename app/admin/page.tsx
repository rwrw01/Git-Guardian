"use client";

import { useState, useEffect } from "react";

interface DashboardData {
  subscribers: number;
  totalScans: number;
  recentFindings: Array<{
    severity: string;
    category: string;
    repo: string;
    file: string;
    description: string;
  }>;
  severityCounts: { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number };
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [scanUsername, setScanUsername] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState("");

  useEffect(() => {
    async function load() {
      const [subRes, scanRes] = await Promise.all([
        fetch("/api/admin/subscribers"),
        fetch("/api/admin/scans?limit=5"),
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

      setData({
        subscribers: subs.count ?? 0,
        totalScans: scans.total ?? 0,
        recentFindings: allFindings.slice(0, 10),
        severityCounts,
      });
    }
    load();
  }, []);

  async function triggerScan() {
    if (!scanUsername.trim()) return;
    setScanning(true);
    setScanResult("");
    try {
      const res = await fetch("/api/admin/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUsername: scanUsername, useDeepseek: true }),
      });
      const result = await res.json();
      if (res.ok) {
        setScanResult(`Scan complete: ${result.findings} findings in ${result.repos} repos`);
      } else {
        setScanResult(`Error: ${result.message ?? result.error}`);
      }
    } catch {
      setScanResult("Network error");
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

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
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
        {scanResult && (
          <div style={{ marginTop: 8, fontSize: 12, color: scanResult.startsWith("Error") ? "#f44747" : "#6a9955" }}>
            {scanResult}
          </div>
        )}
      </div>

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
          <p style={{ color: "#858585", fontSize: 13 }}>No findings yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #3c3c3c", color: "#858585", textAlign: "left" }}>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Severity</th>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Type</th>
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
                  <td style={{ padding: "6px 8px", color: "#ce9178", fontFamily: "monospace" }}>
                    {f.repo.split("/")[1]}:{f.file}
                  </td>
                  <td style={{ padding: "6px 8px", color: "#cccccc" }}>{f.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
