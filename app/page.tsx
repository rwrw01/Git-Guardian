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
      <h1 style={{ fontSize: 36, marginBottom: 8, color: "#fff" }}>
        <span style={{ color: "#2ea043" }}>Git</span> Guardian
      </h1>
      <p style={{ fontSize: 18, color: "#9ca3af", marginBottom: 40, lineHeight: 1.6 }}>
        Scan your public GitHub repositories for leaked secrets, vulnerable
        dependencies, and exposed personal data. Free, one-time scan — report
        delivered by email.
      </p>

      <div
        style={{
          background: "rgba(255, 255, 255, 0.05)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 12,
          padding: 32,
          backdropFilter: "blur(10px)",
        }}
      >
        <h2 style={{ fontSize: 20, marginTop: 0, marginBottom: 24, color: "#fff" }}>
          Start a scan
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="username"
              style={{ display: "block", fontWeight: 600, marginBottom: 6, color: "#d1d5db" }}
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
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 8,
                boxSizing: "border-box",
                color: "#fff",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label
              htmlFor="email"
              style={{ display: "block", fontWeight: 600, marginBottom: 6, color: "#d1d5db" }}
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
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 8,
                boxSizing: "border-box",
                color: "#fff",
                outline: "none",
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
              background: status === "scanning"
                ? "rgba(255, 255, 255, 0.15)"
                : "linear-gradient(135deg, #2ea043 0%, #238636 100%)",
              backgroundColor: status === "scanning" ? "rgba(255,255,255,0.15)" : "#2ea043",
              border: "none",
              borderRadius: 8,
              cursor: status === "scanning" ? "not-allowed" : "pointer",
              transition: "opacity 0.2s",
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
              backgroundColor: status === "error"
                ? "rgba(220, 38, 38, 0.15)"
                : "rgba(46, 160, 67, 0.15)",
              color: status === "error" ? "#fca5a5" : "#86efac",
              border: `1px solid ${status === "error" ? "rgba(220, 38, 38, 0.3)" : "rgba(46, 160, 67, 0.3)"}`,
            }}
          >
            {message}
          </div>
        )}
      </div>

      <div style={{ marginTop: 40, fontSize: 14, color: "#9ca3af" }}>
        <h3 style={{ fontSize: 16, color: "#d1d5db" }}>What we scan</h3>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
          <li>
            <strong style={{ color: "#2ea043" }}>Secrets &amp; tokens</strong> — AWS keys, GitHub tokens,
            private keys, API keys, database URLs, and 20+ more patterns
          </li>
          <li>
            <strong style={{ color: "#2ea043" }}>Dependency vulnerabilities</strong> — known CVEs in npm,
            PyPI, Go, and Maven packages via OSV.dev
          </li>
          <li>
            <strong style={{ color: "#2ea043" }}>Personal data (PII)</strong> — BSN, IBAN, email, phone
            numbers, KvK numbers, postal codes (NL-specific)
          </li>
        </ul>

        <h3 style={{ fontSize: 16, color: "#d1d5db" }}>Privacy</h3>
        <p style={{ lineHeight: 1.6 }}>
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
          borderTop: "1px solid rgba(255, 255, 255, 0.1)",
          fontSize: 12,
          color: "#6b7280",
        }}
      >
        Git Guardian &mdash; EUPL-1.2 &mdash;{" "}
        <a
          href="https://github.com/rwrw01/Git-Guardian"
          style={{ color: "#2ea043" }}
        >
          Source
        </a>
      </footer>
    </main>
  );
}
