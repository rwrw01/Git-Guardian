"use client";

import { useState, useEffect } from "react";

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#f44747",
  HIGH: "#cd9731",
  MEDIUM: "#e2c08d",
  LOW: "#3794ff",
};

interface ScanReport {
  id: string;
  githubUsername: string;
  scannedAt: string;
  totalRepos: number;
  findings: Array<{
    severity: string;
    category: string;
    repo: string;
    file: string;
    line: number;
    description: string;
    impact: string;
    fix: string;
    reference: string;
    maskedValue?: string;
  }>;
  maturity: { secrets: number; dependencies: number; pii: number };
}

export default function ScansPage() {
  const [reports, setReports] = useState<ScanReport[]>([]);
  const [selected, setSelected] = useState<ScanReport | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetch("/api/admin/scans?limit=50")
      .then((r) => r.json())
      .then((data) => {
        setReports(data.reports ?? []);
        setTotal(data.total ?? 0);
      });
  }, []);

  function exportReport(id: string, format: string) {
    window.open(`/api/admin/export?id=${encodeURIComponent(id)}&format=${format}`, "_blank");
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, color: "#cccccc", fontWeight: 400, marginBottom: 24 }}>
        Scan History
        <span style={{ fontSize: 12, color: "#858585", marginLeft: 12 }}>{total} total</span>
      </h1>

      <div style={{ display: "flex", gap: 16 }}>
        {/* Report list */}
        <div style={{ width: 340, flexShrink: 0 }}>
          <div style={{ background: "#252526", border: "1px solid #3c3c3c", borderRadius: 4 }}>
            {reports.length === 0 ? (
              <p style={{ color: "#858585", fontSize: 13, padding: 20, textAlign: "center" }}>No scan reports yet.</p>
            ) : (
              reports.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelected(r)}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #2d2d2d",
                    cursor: "pointer",
                    backgroundColor: selected?.id === r.id ? "#094771" : "transparent",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#9cdcfe", fontSize: 13, fontFamily: "monospace" }}>{r.githubUsername}</span>
                    <span style={{ color: "#858585", fontSize: 11 }}>
                      {new Date(r.scannedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#858585", marginTop: 4 }}>
                    {r.totalRepos} repos — {r.findings.length} findings
                    {r.findings.some((f) => f.severity === "CRITICAL") && (
                      <span style={{ color: "#f44747", marginLeft: 8 }}>CRITICAL</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Report detail */}
        <div style={{ flex: 1 }}>
          {!selected ? (
            <div style={{ background: "#252526", border: "1px solid #3c3c3c", borderRadius: 4, padding: 40, textAlign: "center" }}>
              <p style={{ color: "#858585", fontSize: 13 }}>Select a scan report to view details.</p>
            </div>
          ) : (
            <div style={{ background: "#252526", border: "1px solid #3c3c3c", borderRadius: 4, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 16, color: "#cccccc", fontWeight: 400, margin: 0 }}>
                    {selected.githubUsername} — {new Date(selected.scannedAt).toLocaleString()}
                  </h2>
                  <p style={{ fontSize: 12, color: "#858585", margin: "4px 0 0" }}>
                    {selected.totalRepos} repos — Maturity: secrets {selected.maturity.secrets}/5, deps {selected.maturity.dependencies}/5, pii {selected.maturity.pii}/5
                  </p>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => exportReport(selected.id, "json")} style={{ padding: "4px 10px", fontSize: 11, background: "#3c3c3c", color: "#ccc", border: "none", borderRadius: 2, cursor: "pointer" }}>
                    Export JSON
                  </button>
                  <button onClick={() => exportReport(selected.id, "html")} style={{ padding: "4px 10px", fontSize: 11, background: "#3c3c3c", color: "#ccc", border: "none", borderRadius: 2, cursor: "pointer" }}>
                    Export HTML
                  </button>
                </div>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #3c3c3c", color: "#858585", textAlign: "left" }}>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>Severity</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>Type</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>File</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>Line</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>Description</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>Fix</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.findings.map((f, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #2d2d2d" }}>
                      <td style={{ padding: "6px 8px" }}>
                        <span style={{ color: SEVERITY_COLORS[f.severity] ?? "#ccc", fontWeight: 600, fontSize: 11 }}>
                          {f.severity}
                        </span>
                      </td>
                      <td style={{ padding: "6px 8px", color: "#9cdcfe" }}>{f.category}</td>
                      <td style={{ padding: "6px 8px", color: "#ce9178", fontFamily: "monospace", fontSize: 11 }}>{f.file}</td>
                      <td style={{ padding: "6px 8px", color: "#b5cea8", fontFamily: "monospace" }}>{f.line}</td>
                      <td style={{ padding: "6px 8px", color: "#cccccc" }}>{f.description}</td>
                      <td style={{ padding: "6px 8px", color: "#6a9955", fontSize: 11 }}>{f.fix}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selected.findings.length === 0 && (
                <p style={{ color: "#6a9955", fontSize: 13, textAlign: "center", padding: 20 }}>Clean scan — no findings.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
