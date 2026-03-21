"use client";

import { useState, useEffect, useCallback } from "react";

interface Subscriber {
  githubUsername: string;
  email: string;
  createdAt: string;
  lastScanAt: string | null;
  isOwner: boolean;
  mistralEnabled: boolean;
  scanFrequency?: "daily" | "weekly" | "monthly";
}

const FREQ_LABELS: Record<string, string> = {
  daily: "D",
  weekly: "W",
  monthly: "M",
};

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [message, setMessage] = useState("");
  const [scanningUser, setScanningUser] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/subscribers");
    const data = await res.json();
    setSubscribers(data.subscribers ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addSub() {
    if (!newUsername || !newEmail) return;
    const res = await fetch("/api/admin/subscribers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ githubUsername: newUsername, email: newEmail }),
    });
    if (res.ok) {
      setNewUsername("");
      setNewEmail("");
      setMessage(`Added ${newUsername}`);
      load();
    }
  }

  async function removeSub(username: string) {
    await fetch("/api/admin/subscribers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ githubUsername: username }),
    });
    setMessage(`Removed ${username}`);
    load();
  }

  async function updateSub(username: string, updates: Partial<Subscriber>) {
    await fetch("/api/admin/subscribers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ githubUsername: username, ...updates }),
    });
    load();
  }

  async function scanNow(s: Subscriber) {
    setScanningUser(s.githubUsername);
    setMessage("");
    try {
      const res = await fetch("/api/admin/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubUsername: s.githubUsername,
          sendEmail: true,
          useMistral: s.mistralEnabled,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        setMessage(`Scan ${s.githubUsername}: ${result.findings} findings in ${result.repos} repos — rapport verstuurd`);
        load();
      } else {
        setMessage(`Scan ${s.githubUsername} mislukt: ${result.message ?? result.error}`);
      }
    } catch {
      setMessage(`Scan ${s.githubUsername}: netwerkfout`);
    }
    setScanningUser(null);
  }

  const btnStyle = (active: boolean) => ({
    padding: "1px 5px",
    fontSize: 10,
    background: active ? "#2ea043" : "transparent",
    color: active ? "#fff" : "#858585",
    border: `1px solid ${active ? "#2ea043" : "#555"}`,
    borderRadius: 2,
    cursor: "pointer" as const,
    minWidth: 20,
    textAlign: "center" as const,
  });

  return (
    <div>
      <h1 style={{ fontSize: 20, color: "#cccccc", fontWeight: 400, marginBottom: 24 }}>
        Subscribers
      </h1>

      {/* Add subscriber */}
      <div style={{ background: "#252526", border: "1px solid #3c3c3c", borderRadius: 4, padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 13, color: "#cccccc", fontWeight: 600, marginTop: 0, marginBottom: 12, textTransform: "uppercase" }}>
          Add Subscriber
        </h2>
        <div className="form-row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
            placeholder="GitHub username"
            style={{ flex: 1, minWidth: 140, padding: "6px 10px", fontSize: 13, background: "#3c3c3c", border: "1px solid #555", borderRadius: 2, color: "#ccc", outline: "none" }}
          />
          <input
            type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
            placeholder="email@example.com"
            style={{ flex: 1, minWidth: 140, padding: "6px 10px", fontSize: 13, background: "#3c3c3c", border: "1px solid #555", borderRadius: 2, color: "#ccc", outline: "none" }}
          />
          <button onClick={addSub} style={{ padding: "6px 16px", fontSize: 13, background: "#2ea043", color: "#fff", border: "none", borderRadius: 2, cursor: "pointer" }}>
            Add
          </button>
        </div>
        {message && <div style={{ marginTop: 8, fontSize: 12, color: message.includes("mislukt") || message.includes("fout") ? "#f44747" : "#6a9955" }}>{message}</div>}
      </div>

      {/* Subscriber list */}
      <div style={{ background: "#252526", border: "1px solid #3c3c3c", borderRadius: 4, padding: 20 }}>
        <div className="table-wrap">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #3c3c3c", color: "#858585", textAlign: "left" }}>
              <th style={{ padding: "6px 8px", fontWeight: 600 }}>Username</th>
              <th style={{ padding: "6px 8px", fontWeight: 600 }}>Email</th>
              <th style={{ padding: "6px 8px", fontWeight: 600 }}>Frequentie</th>
              <th style={{ padding: "6px 8px", fontWeight: 600 }}>Mistral</th>
              <th style={{ padding: "6px 8px", fontWeight: 600 }}>Last Scan</th>
              <th style={{ padding: "6px 8px", fontWeight: 600 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.map((s) => (
              <tr key={s.githubUsername} style={{ borderBottom: "1px solid #2d2d2d" }}>
                <td style={{ padding: "6px 8px", color: "#9cdcfe", fontFamily: "monospace" }}>{s.githubUsername}</td>
                <td style={{ padding: "6px 8px", color: "#cccccc" }}>{s.email}</td>
                <td style={{ padding: "6px 8px" }}>
                  <div style={{ display: "flex", gap: 2 }}>
                    {(["daily", "weekly", "monthly"] as const).map((freq) => (
                      <button
                        key={freq}
                        onClick={() => updateSub(s.githubUsername, { scanFrequency: freq })}
                        style={btnStyle((s.scanFrequency ?? "daily") === freq)}
                        title={freq === "daily" ? "Dagelijks" : freq === "weekly" ? "Wekelijks" : "Maandelijks"}
                      >
                        {FREQ_LABELS[freq]}
                      </button>
                    ))}
                  </div>
                </td>
                <td style={{ padding: "6px 8px" }}>
                  <button
                    onClick={() => updateSub(s.githubUsername, { mistralEnabled: !s.mistralEnabled })}
                    style={btnStyle(s.mistralEnabled)}
                    title={s.mistralEnabled ? "Mistral aan — klik om uit te zetten" : "Mistral uit — klik om aan te zetten"}
                  >
                    AI
                  </button>
                </td>
                <td style={{ padding: "6px 8px", color: "#858585" }}>
                  {s.lastScanAt ? new Date(s.lastScanAt).toLocaleDateString() : "—"}
                </td>
                <td style={{ padding: "6px 8px", display: "flex", gap: 4 }}>
                  <button
                    onClick={() => scanNow(s)}
                    disabled={scanningUser === s.githubUsername}
                    style={{
                      padding: "2px 8px",
                      fontSize: 11,
                      background: scanningUser === s.githubUsername ? "#3c3c3c" : "#2ea043",
                      color: "#fff",
                      border: "none",
                      borderRadius: 2,
                      cursor: scanningUser === s.githubUsername ? "not-allowed" : "pointer",
                    }}
                  >
                    {scanningUser === s.githubUsername ? "Scanning..." : "Nu scannen"}
                  </button>
                  {!s.isOwner && (
                    <button
                      onClick={() => removeSub(s.githubUsername)}
                      style={{ padding: "2px 8px", fontSize: 11, background: "transparent", border: "1px solid #f44747", color: "#f44747", borderRadius: 2, cursor: "pointer" }}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {subscribers.length === 0 && <p style={{ color: "#858585", fontSize: 13, textAlign: "center", padding: 20 }}>No subscribers yet.</p>}
      </div>
    </div>
  );
}
