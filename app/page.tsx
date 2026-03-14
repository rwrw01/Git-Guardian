"use client";

import { useState } from "react";

type Status = "idle" | "scanning" | "done" | "error";

export default function Home() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("scanning");
    setMessage("");

    try {
      const res = await fetch("/api/scan-once", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUsername: username, email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.message ?? data.error ?? "Something went wrong");
        return;
      }

      setStatus("done");
      setMessage(data.message);
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <main
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "60px 20px",
      }}
    >
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Git Guardian</h1>
      <p style={{ fontSize: 18, color: "#6b7280", marginBottom: 40 }}>
        Scan your public GitHub repositories for leaked secrets, vulnerable
        dependencies, and exposed personal data. Free, one-time scan — report
        delivered by email.
      </p>

      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 32,
        }}
      >
        <h2 style={{ fontSize: 20, marginTop: 0, marginBottom: 24 }}>
          Start a scan
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="username"
              style={{ display: "block", fontWeight: 600, marginBottom: 4 }}
            >
              GitHub username
            </label>
            <input
              id="username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="octocat"
              pattern="^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$"
              maxLength={39}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 16,
                border: "1px solid #d1d5db",
                borderRadius: 8,
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label
              htmlFor="email"
              style={{ display: "block", fontWeight: 600, marginBottom: 4 }}
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 16,
                border: "1px solid #d1d5db",
                borderRadius: 8,
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={status === "scanning"}
            style={{
              width: "100%",
              padding: "12px",
              fontSize: 16,
              fontWeight: 600,
              color: "#fff",
              backgroundColor: status === "scanning" ? "#9ca3af" : "#1f2937",
              border: "none",
              borderRadius: 8,
              cursor: status === "scanning" ? "not-allowed" : "pointer",
            }}
          >
            {status === "scanning" ? "Scanning..." : "Start scan"}
          </button>
        </form>

        {message && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 8,
              fontSize: 14,
              backgroundColor: status === "error" ? "#fef2f2" : "#f0fdf4",
              color: status === "error" ? "#991b1b" : "#166534",
              border: `1px solid ${status === "error" ? "#fecaca" : "#bbf7d0"}`,
            }}
          >
            {message}
          </div>
        )}
      </div>

      <div style={{ marginTop: 40, fontSize: 14, color: "#6b7280" }}>
        <h3 style={{ fontSize: 16, color: "#1f2937" }}>What we scan</h3>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
          <li>
            <strong>Secrets &amp; tokens</strong> — AWS keys, GitHub tokens,
            private keys, API keys, database URLs, and 20+ more patterns
          </li>
          <li>
            <strong>Dependency vulnerabilities</strong> — known CVEs in npm,
            PyPI, Go, and Maven packages via OSV.dev
          </li>
          <li>
            <strong>Personal data (PII)</strong> — BSN, IBAN, email, phone
            numbers, KvK numbers, postal codes (NL-specific)
          </li>
        </ul>

        <h3 style={{ fontSize: 16, color: "#1f2937" }}>Privacy</h3>
        <p>
          We only read publicly available repository data via the GitHub API. Your
          email address is stored to deliver the report and for optional daily
          scans. Every email includes an unsubscribe link. We do not share your
          data with third parties.
        </p>
      </div>

      <footer
        style={{
          marginTop: 60,
          paddingTop: 20,
          borderTop: "1px solid #e5e7eb",
          fontSize: 12,
          color: "#9ca3af",
        }}
      >
        Git Guardian &mdash; EUPL-1.2 &mdash;{" "}
        <a
          href="https://github.com/rwrw01/Git-Guardian"
          style={{ color: "#9ca3af" }}
        >
          Source
        </a>
      </footer>
    </main>
  );
}
