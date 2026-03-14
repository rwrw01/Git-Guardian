"use client";

export default function SettingsPage() {
  return (
    <div>
      <h1 style={{ fontSize: 20, color: "#cccccc", fontWeight: 400, marginBottom: 24 }}>
        Settings
      </h1>

      <div style={{ background: "#252526", border: "1px solid #3c3c3c", borderRadius: 4, padding: 20, marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, color: "#cccccc", fontWeight: 600, marginTop: 0, marginBottom: 16, textTransform: "uppercase" }}>
          Scan Configuration
        </h2>
        <table style={{ fontSize: 13, color: "#cccccc", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ padding: "6px 16px 6px 0", color: "#858585" }}>Daily cron schedule</td>
              <td style={{ fontFamily: "monospace", color: "#ce9178" }}>0 6 * * * (06:00 UTC)</td>
            </tr>
            <tr>
              <td style={{ padding: "6px 16px 6px 0", color: "#858585" }}>Scan timeout (daily)</td>
              <td style={{ fontFamily: "monospace", color: "#b5cea8" }}>300s (5 min)</td>
            </tr>
            <tr>
              <td style={{ padding: "6px 16px 6px 0", color: "#858585" }}>Scan timeout (one-time)</td>
              <td style={{ fontFamily: "monospace", color: "#b5cea8" }}>120s (2 min)</td>
            </tr>
            <tr>
              <td style={{ padding: "6px 16px 6px 0", color: "#858585" }}>Rate limit (self-service)</td>
              <td style={{ fontFamily: "monospace", color: "#b5cea8" }}>1 scan / email / hour</td>
            </tr>
            <tr>
              <td style={{ padding: "6px 16px 6px 0", color: "#858585" }}>DeepSeek model</td>
              <td style={{ fontFamily: "monospace", color: "#ce9178" }}>deepseek-reasoner</td>
            </tr>
            <tr>
              <td style={{ padding: "6px 16px 6px 0", color: "#858585" }}>Report retention</td>
              <td style={{ fontFamily: "monospace", color: "#b5cea8" }}>90 days</td>
            </tr>
          </tbody>
        </table>
      </div>

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
              "KV_REST_API_URL",
              "KV_REST_API_TOKEN",
              "DEEPSEEK_API_KEY",
              "GITHUB_CLIENT_ID",
              "GITHUB_CLIENT_SECRET",
              "AUTH_SECRET",
              "ADMIN_GITHUB_USERS",
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

      <div style={{ background: "#252526", border: "1px solid #3c3c3c", borderRadius: 4, padding: 20 }}>
        <h2 style={{ fontSize: 13, color: "#cccccc", fontWeight: 600, marginTop: 0, marginBottom: 16, textTransform: "uppercase" }}>
          Security
        </h2>
        <ul style={{ fontSize: 13, color: "#cccccc", lineHeight: 2, paddingLeft: 20 }}>
          <li>Authentication: <span style={{ color: "#9cdcfe" }}>GitHub OAuth (OIDC)</span></li>
          <li>Session: <span style={{ color: "#9cdcfe" }}>JWT, 8-hour max age</span></li>
          <li>Access control: <span style={{ color: "#9cdcfe" }}>Whitelist-based (ADMIN_GITHUB_USERS)</span></li>
          <li>Audit logging: <span style={{ color: "#6a9955" }}>Active — all admin actions logged</span></li>
          <li>API secrets: <span style={{ color: "#6a9955" }}>Backend-only, never client-side</span></li>
        </ul>
      </div>
    </div>
  );
}
