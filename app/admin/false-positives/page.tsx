"use client";

import { useState, useEffect, useCallback } from "react";

interface FalsePositive {
  findingHash: string;
  repo: string;
  file: string;
  pattern: string;
  markedBy: string;
  markedAt: string;
  reason: string;
}

export default function FalsePositivesPage() {
  const [fps, setFps] = useState<FalsePositive[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/false-positives");
    const data = await res.json();
    setFps(data.falsePositives ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function removeFp(hash: string) {
    await fetch("/api/admin/false-positives", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ findingHash: hash }),
    });
    setMessage("False positive marker removed — finding will reappear in next scan");
    load();
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, color: "#cccccc", fontWeight: 400, marginBottom: 24 }}>
        False Positives
        <span style={{ fontSize: 12, color: "#858585", marginLeft: 12 }}>{fps.length} marked</span>
      </h1>

      {message && (
        <div style={{ background: "#252526", border: "1px solid #3c3c3c", borderRadius: 4, padding: "8px 16px", marginBottom: 16, fontSize: 12, color: "#6a9955" }}>
          {message}
        </div>
      )}

      <div style={{ background: "#252526", border: "1px solid #3c3c3c", borderRadius: 4, padding: 20 }}>
        <p style={{ fontSize: 12, color: "#858585", marginTop: 0, marginBottom: 16 }}>
          Findings marked as false positive will be excluded from future scan reports.
          Removing a marker will cause the finding to reappear.
        </p>

        {fps.length === 0 ? (
          <p style={{ color: "#858585", fontSize: 13, textAlign: "center", padding: 20 }}>No false positives marked.</p>
        ) : (
          <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #3c3c3c", color: "#858585", textAlign: "left" }}>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Repo</th>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>File</th>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Reason</th>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Marked By</th>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Date</th>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {fps.map((fp) => (
                <tr key={fp.findingHash} style={{ borderBottom: "1px solid #2d2d2d" }}>
                  <td style={{ padding: "6px 8px", color: "#9cdcfe", fontFamily: "monospace", fontSize: 11 }}>{fp.repo}</td>
                  <td style={{ padding: "6px 8px", color: "#ce9178", fontFamily: "monospace", fontSize: 11 }}>{fp.file}</td>
                  <td style={{ padding: "6px 8px", color: "#cccccc" }}>{fp.reason}</td>
                  <td style={{ padding: "6px 8px", color: "#858585" }}>{fp.markedBy}</td>
                  <td style={{ padding: "6px 8px", color: "#858585" }}>{new Date(fp.markedAt).toLocaleDateString()}</td>
                  <td style={{ padding: "6px 8px" }}>
                    <button
                      onClick={() => removeFp(fp.findingHash)}
                      style={{ padding: "2px 8px", fontSize: 11, background: "transparent", border: "1px solid #cd9731", color: "#cd9731", borderRadius: 2, cursor: "pointer" }}
                    >
                      Unmark
                    </button>
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
