"use client";

import { useState, useEffect } from "react";
import { MarkdownPanel } from "../markdown-panel";

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#f44747",
  HIGH: "#cd9731",
  MEDIUM: "#e2c08d",
  LOW: "#3794ff",
};

interface Finding {
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
}

interface ScanReport {
  id: string;
  githubUsername: string;
  scannedAt: string;
  totalRepos: number;
  findings: Finding[];
  maturity: { secrets: number; dependencies: number; pii: number };
  deepseekAnalysis?: string | null;
  reportType?: "delta" | "full";
  previousFindingsCount?: number;
}

function findingHash(repo: string, file: string, description: string): string {
  // Must match server: Buffer.from(str).toString("base64url").slice(0, 32)
  const str = `${repo}:${file}:${description}`;
  const bytes = new TextEncoder().encode(str);
  let b64 = "";
  for (const byte of bytes) b64 += String.fromCharCode(byte);
  return btoa(b64).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "").slice(0, 32);
}

export default function ScansPage() {
  const [reports, setReports] = useState<ScanReport[]>([]);
  const [selected, setSelected] = useState<ScanReport | null>(null);
  const [total, setTotal] = useState(0);
  const [fpMessage, setFpMessage] = useState("");
  const [markedFps, setMarkedFps] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/admin/scans?limit=50")
      .then((r) => r.json())
      .then((data) => {
        setReports(data.reports ?? []);
        setTotal(data.total ?? 0);
      });
    // Load existing FPs
    fetch("/api/admin/false-positives")
      .then((r) => r.json())
      .then((data) => {
        const hashes = (data.falsePositives ?? []).map((fp: { findingHash: string }) => fp.findingHash);
        setMarkedFps(new Set(hashes));
      });
  }, []);

  function exportReport(id: string, format: string) {
    window.open(`/api/admin/export?id=${encodeURIComponent(id)}&format=${format}`, "_blank");
  }

  async function markAsFp(f: Finding) {
    const reason = prompt("Reden voor false positive:");
    if (!reason) return;

    const hash = findingHash(f.repo, f.file, f.description);
    const res = await fetch("/api/admin/false-positives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        findingHash: hash,
        repo: f.repo,
        file: f.file,
        pattern: f.description,
        reason,
      }),
    });

    if (res.ok) {
      setMarkedFps((prev) => new Set([...prev, hash]));
      setFpMessage(`"${f.description}" in ${f.file} gemarkeerd als false positive`);
      setTimeout(() => setFpMessage(""), 5000);
    }
  }

  function isFp(f: Finding): boolean {
    return markedFps.has(findingHash(f.repo, f.file, f.description));
  }

  async function bulkMarkFp(findings: Finding[], reason: string) {
    let count = 0;
    for (const f of findings) {
      if (isFp(f)) continue;
      const hash = findingHash(f.repo, f.file, f.description);
      const res = await fetch("/api/admin/false-positives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findingHash: hash,
          repo: f.repo,
          file: f.file,
          pattern: f.description,
          reason,
        }),
      });
      if (res.ok) {
        setMarkedFps((prev) => new Set([...prev, hash]));
        count++;
      }
    }
    setFpMessage(`${count} bevindingen gemarkeerd als false positive`);
    setTimeout(() => setFpMessage(""), 5000);
  }

  async function markFileAsFp(file: string) {
    if (!selected) return;
    const fileFindings = selected.findings.filter((f) => f.file === file && !isFp(f));
    if (fileFindings.length === 0) return;
    const reason = prompt(`Alle ${fileFindings.length} bevindingen in ${file} markeren als FP. Reden:`);
    if (!reason) return;
    await bulkMarkFp(fileFindings, reason);
  }

  async function markPatternAsFp(description: string) {
    if (!selected) return;
    const patternFindings = selected.findings.filter((f) => f.description === description && !isFp(f));
    if (patternFindings.length === 0) return;
    const reason = prompt(`Alle ${patternFindings.length} "${description}" bevindingen markeren als FP. Reden:`);
    if (!reason) return;
    await bulkMarkFp(patternFindings, reason);
  }

  // Group findings by file for bulk actions
  function getFileGroups(): Map<string, Finding[]> {
    if (!selected) return new Map();
    const groups = new Map<string, Finding[]>();
    for (const f of selected.findings) {
      const existing = groups.get(f.file) ?? [];
      existing.push(f);
      groups.set(f.file, existing);
    }
    return groups;
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, color: "#cccccc", fontWeight: 400, marginBottom: 24 }}>
        Scan History
        <span style={{ fontSize: 12, color: "#858585", marginLeft: 12 }}>{total} total</span>
      </h1>

      {fpMessage && (
        <div style={{ background: "#252526", border: "1px solid #6a9955", borderRadius: 4, padding: "8px 16px", marginBottom: 16, fontSize: 12, color: "#6a9955" }}>
          {fpMessage}
        </div>
      )}

      <div className="split-panel" style={{ display: "flex", gap: 16 }}>
        {/* Report list */}
        <div style={{ width: 340, flexShrink: 0, minWidth: 0 }}>
          <div style={{ background: "#252526", border: "1px solid #3c3c3c", borderRadius: 4 }}>
            {reports.length === 0 ? (
              <p style={{ color: "#858585", fontSize: 13, padding: 20, textAlign: "center" }}>Nog geen scanrapporten.</p>
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
                    {r.reportType === "delta" && (
                      <span style={{ color: "#3794ff", marginLeft: 8 }}>DELTA</span>
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
              <p style={{ color: "#858585", fontSize: 13 }}>Selecteer een scanrapport om details te bekijken.</p>
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
                    {selected.reportType === "delta" && selected.previousFindingsCount ? ` — ${selected.previousFindingsCount} eerder gemeld` : ""}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => exportReport(selected.id, "json")} style={{ padding: "4px 10px", fontSize: 11, background: "#3c3c3c", color: "#ccc", border: "none", borderRadius: 2, cursor: "pointer" }}>
                    JSON
                  </button>
                  <button onClick={() => exportReport(selected.id, "html")} style={{ padding: "4px 10px", fontSize: 11, background: "#3c3c3c", color: "#ccc", border: "none", borderRadius: 2, cursor: "pointer" }}>
                    HTML
                  </button>
                </div>
              </div>

              {/* DeepSeek analysis */}
              {selected.deepseekAnalysis && (
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: 12, color: "#858585", fontWeight: 600, marginTop: 0, marginBottom: 8, textTransform: "uppercase" }}>AI-analyse (DeepSeek)</h3>
                  <MarkdownPanel content={selected.deepseekAnalysis} maxHeight={400} />
                </div>
              )}

              {/* Bulk FP actions */}
              {selected.findings.length > 0 && (
                <div style={{ marginBottom: 12, display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#858585", marginRight: 4 }}>Bulk FP:</span>
                  {Array.from(getFileGroups().entries())
                    .filter(([, fs]) => fs.some((f) => !isFp(f)))
                    .slice(0, 8)
                    .map(([file, fs]) => (
                      <button
                        key={file}
                        onClick={() => markFileAsFp(file)}
                        title={`Markeer alle ${fs.length} bevindingen in ${file} als FP`}
                        style={{
                          padding: "2px 6px",
                          fontSize: 10,
                          background: "transparent",
                          border: "1px solid #3c3c3c",
                          color: "#858585",
                          borderRadius: 2,
                          cursor: "pointer",
                          maxWidth: 200,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {file.split("/").pop()} ({fs.filter((f) => !isFp(f)).length})
                      </button>
                    ))}
                </div>
              )}

              <div className="table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #3c3c3c", color: "#858585", textAlign: "left" }}>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>Severity</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>Type</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>Repo</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>File</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>Description</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.findings.map((f, i) => {
                    const fp = isFp(f);
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #2d2d2d", opacity: fp ? 0.4 : 1 }}>
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
                          {f.file}:{f.line}
                        </td>
                        <td style={{ padding: "6px 8px", color: "#cccccc" }}>
                          {f.description}
                          {f.maskedValue && (
                            <span style={{ marginLeft: 6, fontSize: 10, color: "#6b7280", fontFamily: "monospace" }}>
                              {f.maskedValue}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                          {fp ? (
                            <span style={{ fontSize: 10, color: "#858585" }}>FP</span>
                          ) : (
                            <>
                              <button
                                onClick={() => markAsFp(f)}
                                title="Markeer deze finding als false positive"
                                style={{
                                  padding: "2px 6px",
                                  fontSize: 10,
                                  background: "transparent",
                                  border: "1px solid #555",
                                  color: "#858585",
                                  borderRadius: 2,
                                  cursor: "pointer",
                                  marginRight: 2,
                                }}
                              >
                                FP
                              </button>
                              <button
                                onClick={() => markPatternAsFp(f.description)}
                                title={`Markeer alle "${f.description}" als FP`}
                                style={{
                                  padding: "2px 6px",
                                  fontSize: 10,
                                  background: "transparent",
                                  border: "1px solid #555",
                                  color: "#858585",
                                  borderRadius: 2,
                                  cursor: "pointer",
                                }}
                              >
                                Alle
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              {selected.findings.length === 0 && (
                <p style={{ color: "#6a9955", fontSize: 13, textAlign: "center", padding: 20 }}>Schone scan — geen bevindingen.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
