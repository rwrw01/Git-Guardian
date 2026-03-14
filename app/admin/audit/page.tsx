"use client";

import { useState, useEffect } from "react";

interface AuditEntry {
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  details: string;
}

const ACTION_COLORS: Record<string, string> = {
  SCAN_MANUAL: "#3794ff",
  SCAN_COMPLETE: "#6a9955",
  SCAN_ERROR: "#f44747",
  SUBSCRIBER_ADD: "#dcdcaa",
  SUBSCRIBER_REMOVE: "#cd9731",
  FP_MARK: "#c586c0",
  FP_UNMARK: "#c586c0",
  EXPORT: "#9cdcfe",
};

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetch("/api/admin/audit?limit=100")
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.entries ?? []);
        setTotal(data.total ?? 0);
      });
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 20, color: "#cccccc", fontWeight: 400, marginBottom: 24 }}>
        Audit Log
        <span style={{ fontSize: 12, color: "#858585", marginLeft: 12 }}>{total} events</span>
      </h1>

      <div style={{ background: "#252526", border: "1px solid #3c3c3c", borderRadius: 4, padding: 20 }}>
        {entries.length === 0 ? (
          <p style={{ color: "#858585", fontSize: 13, textAlign: "center" }}>No audit events recorded yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #3c3c3c", color: "#858585", textAlign: "left" }}>
                <th style={{ padding: "6px 8px", fontWeight: 600, width: 160 }}>Timestamp</th>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Actor</th>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Action</th>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Target</th>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #2d2d2d" }}>
                  <td style={{ padding: "6px 8px", color: "#858585", fontFamily: "monospace", fontSize: 11 }}>
                    {new Date(e.timestamp).toLocaleString()}
                  </td>
                  <td style={{ padding: "6px 8px", color: "#9cdcfe" }}>{e.actor}</td>
                  <td style={{ padding: "6px 8px" }}>
                    <span style={{ color: ACTION_COLORS[e.action] ?? "#ccc", fontWeight: 600, fontSize: 11 }}>
                      {e.action}
                    </span>
                  </td>
                  <td style={{ padding: "6px 8px", color: "#ce9178", fontFamily: "monospace", fontSize: 11 }}>{e.target}</td>
                  <td style={{ padding: "6px 8px", color: "#cccccc" }}>{e.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
