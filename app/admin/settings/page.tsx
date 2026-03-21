"use client";

import { useState, useEffect } from "react";
import { MarkdownPanel } from "../markdown-panel";

interface Config {
  scanFrequency: "daily" | "weekly" | "monthly";
  scanHourUtc: number;
  scanDayOfWeek: number; // 0=Sun, 1=Mon, ... 6=Sat
  fullReportDay: number;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<Config>({ scanFrequency: "daily", scanHourUtc: 6, scanDayOfWeek: 1, fullReportDay: 1 });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [mistralPrompt, setDeepseekPrompt] = useState("");

  useEffect(() => {
    fetch("/api/admin/scans?config=true")
      .then((r) => r.json())
      .then((data) => {
        if (data.scanHourUtc !== undefined) {
          setConfig({
            scanFrequency: data.scanFrequency ?? "daily",
            scanHourUtc: data.scanHourUtc,
            scanDayOfWeek: data.scanDayOfWeek ?? 1,
            fullReportDay: data.fullReportDay ?? 1,
          });
        }
      })
      .catch(() => {});
    fetch("/api/admin/scans?mistral-prompt=true")
      .then((r) => r.json())
      .then((data) => setDeepseekPrompt(data.prompt ?? ""))
      .catch(() => {});
  }, []);

  async function saveConfig() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/scans?config=true", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setMessage("Instellingen opgeslagen");
      } else {
        setMessage("Fout bij opslaan");
      }
    } catch {
      setMessage("Netwerkfout");
    }
    setSaving(false);
  }

  const inputStyle = {
    padding: "4px 8px",
    fontSize: 13,
    background: "#3c3c3c",
    border: "1px solid #555",
    borderRadius: 2,
    color: "#cccccc",
    outline: "none",
    fontFamily: "monospace" as const,
    width: 60,
  };

  return (
    <div>
      <h1 style={{ fontSize: 20, color: "#cccccc", fontWeight: 400, marginBottom: 24 }}>
        Settings
      </h1>

      {/* Scan schedule */}
      <div style={{ background: "#252526", border: "1px solid #3c3c3c", borderRadius: 4, padding: 20, marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, color: "#cccccc", fontWeight: 600, marginTop: 0, marginBottom: 16, textTransform: "uppercase" }}>
          Scan Planning
        </h2>
        <table style={{ fontSize: 13, color: "#cccccc", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ padding: "8px 16px 8px 0", color: "#858585" }}>Scan frequentie</td>
              <td>
                <select
                  value={config.scanFrequency}
                  onChange={(e) => setConfig({ ...config, scanFrequency: e.target.value as Config["scanFrequency"] })}
                  style={{ ...inputStyle, width: 120 }}
                >
                  <option value="daily">Dagelijks</option>
                  <option value="weekly">Wekelijks</option>
                  <option value="monthly">Maandelijks</option>
                </select>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px 16px 8px 0", color: "#858585" }}>Tijdstip (UTC)</td>
              <td>
                <select
                  value={config.scanHourUtc}
                  onChange={(e) => setConfig({ ...config, scanHourUtc: parseInt(e.target.value, 10) })}
                  style={{ ...inputStyle, width: 80 }}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{`${h.toString().padStart(2, "0")}:00`}</option>
                  ))}
                </select>
                <span style={{ fontSize: 11, color: "#858585", marginLeft: 8 }}>
                  = {((config.scanHourUtc + 1) % 24).toString().padStart(2, "0")}:00 CET /
                  {" "}{((config.scanHourUtc + 2) % 24).toString().padStart(2, "0")}:00 CEST
                </span>
              </td>
            </tr>
            {config.scanFrequency === "weekly" && (
              <tr>
                <td style={{ padding: "8px 16px 8px 0", color: "#858585" }}>Dag van de week</td>
                <td>
                  <select
                    value={config.scanDayOfWeek}
                    onChange={(e) => setConfig({ ...config, scanDayOfWeek: parseInt(e.target.value, 10) })}
                    style={{ ...inputStyle, width: 120 }}
                  >
                    {["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"].map((day, i) => (
                      <option key={i} value={i}>{day}</option>
                    ))}
                  </select>
                </td>
              </tr>
            )}
            {config.scanFrequency === "monthly" && (
              <tr>
                <td style={{ padding: "8px 16px 8px 0", color: "#858585" }}>Dag van de maand</td>
                <td>
                  <select
                    value={config.scanDayOfWeek}
                    onChange={(e) => setConfig({ ...config, scanDayOfWeek: parseInt(e.target.value, 10) })}
                    style={{ ...inputStyle, width: 80 }}
                  >
                    {Array.from({ length: 28 }, (_, d) => (
                      <option key={d + 1} value={d + 1}>{`${d + 1}e`}</option>
                    ))}
                  </select>
                </td>
              </tr>
            )}
            <tr>
              <td style={{ padding: "8px 16px 8px 0", color: "#858585" }}>Admin scan timeout</td>
              <td style={{ fontFamily: "monospace", color: "#b5cea8" }}>300s (5 min) — geen limiet bij handmatige scan</td>
            </tr>
            <tr>
              <td style={{ padding: "8px 16px 8px 0", color: "#858585" }}>Self-service rate limit</td>
              <td style={{ fontFamily: "monospace", color: "#b5cea8" }}>1 scan / email / uur</td>
            </tr>
            <tr>
              <td style={{ padding: "8px 16px 8px 0", color: "#858585" }}>Rapport retentie</td>
              <td style={{ fontFamily: "monospace", color: "#b5cea8" }}>90 dagen</td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={saveConfig}
            disabled={saving}
            style={{
              padding: "6px 16px",
              fontSize: 13,
              background: saving ? "#3c3c3c" : "#2ea043",
              color: "#fff",
              border: "none",
              borderRadius: 2,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Opslaan..." : "Opslaan"}
          </button>
          {message && (
            <span style={{ fontSize: 12, color: message.startsWith("Fout") ? "#f44747" : "#6a9955" }}>
              {message}
            </span>
          )}
        </div>
      </div>

      {/* Environment status */}
      <div style={{ background: "#252526", border: "1px solid #3c3c3c", borderRadius: 4, padding: 20, marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, color: "#cccccc", fontWeight: 600, marginTop: 0, marginBottom: 16, textTransform: "uppercase" }}>
          Environment Status
        </h2>
        <table style={{ fontSize: 13, color: "#cccccc", borderCollapse: "collapse" }}>
          <tbody>
            {[
              "GITHUB_TOKEN",
              "RESEND_API_KEY",
              "SCAN_EMAIL_FROM",
              "CRON_SECRET",
              "REDIS_URL",
              "MISTRAL_API_KEY",
              "AUTH_SECRET",
              "ADMIN_EMAILS",
            ].map((name) => (
              <tr key={name}>
                <td style={{ padding: "4px 16px 4px 0", color: "#858585", fontFamily: "monospace", fontSize: 12 }}>
                  {name}
                </td>
                <td>
                  <span style={{ fontSize: 11, color: "#6a9955" }}>configured via Vercel</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Security */}
      <div style={{ background: "#252526", border: "1px solid #3c3c3c", borderRadius: 4, padding: 20 }}>
        <h2 style={{ fontSize: 13, color: "#cccccc", fontWeight: 600, marginTop: 0, marginBottom: 16, textTransform: "uppercase" }}>
          Security
        </h2>
        <ul style={{ fontSize: 13, color: "#cccccc", lineHeight: 2, paddingLeft: 20 }}>
          <li>Authentication: <span style={{ color: "#9cdcfe" }}>Magic-link e-mail (eenmalig, 10 min geldig)</span></li>
          <li>Session: <span style={{ color: "#9cdcfe" }}>Signed cookie, 8 uur max</span></li>
          <li>Access control: <span style={{ color: "#9cdcfe" }}>E-mail whitelist (ADMIN_EMAILS)</span></li>
          <li>Audit logging: <span style={{ color: "#6a9955" }}>Active — all admin actions logged</span></li>
          <li>API secrets: <span style={{ color: "#6a9955" }}>Backend-only, never client-side</span></li>
        </ul>
      </div>

      {/* Mistral prompt */}
      {mistralPrompt && (
        <div style={{ background: "#252526", border: "1px solid #3c3c3c", borderRadius: 4, padding: 20, marginTop: 16 }}>
          <h2 style={{ fontSize: 13, color: "#cccccc", fontWeight: 600, marginTop: 0, marginBottom: 16, textTransform: "uppercase" }}>
            Mistral System Prompt
          </h2>
          <p style={{ fontSize: 12, color: "#858585", marginTop: 0, marginBottom: 12 }}>
            Deze instructie wordt als system prompt naar Mistral gestuurd bij iedere AI-analyse.
          </p>
          <MarkdownPanel content={mistralPrompt} maxHeight={600} />
        </div>
      )}
    </div>
  );
}
