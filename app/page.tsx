"use client";

import { useState } from "react";

type Status = "idle" | "scanning" | "done" | "queued" | "error";

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
        setMessage(data.message ?? data.error ?? "Er ging iets mis");
        return;
      }

      if (data.status === "queued") {
        setStatus("queued");
      } else {
        setStatus("done");
      }
      setMessage(data.message);
    } catch {
      setStatus("error");
      setMessage("Netwerkfout. Probeer het opnieuw.");
    }
  }

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "60px 20px",
      }}
    >
      {/* Hero */}
      <h1 style={{ fontSize: 40, marginBottom: 8, color: "#fff" }}>
        <span style={{ color: "#2ea043" }}>Git</span> Guardian
      </h1>
      <p style={{ fontSize: 20, color: "#d1d5db", marginBottom: 12, lineHeight: 1.5, fontWeight: 500 }}>
        Bescherm je code tegen dezelfde dreigingen die hackers en cybercriminelen ook zien.
      </p>
      <p style={{ fontSize: 16, color: "#9ca3af", marginBottom: 40, lineHeight: 1.7 }}>
        Publieke GitHub-repositories zijn zichtbaar voor iedereen &mdash; ook voor kwaadwillenden.
        Git Guardian scant jouw repositories op gelekte wachtwoorden, API-sleutels, bekende
        kwetsbaarheden in software en onbedoeld gepubliceerde persoonsgegevens. Binnen enkele
        minuten ontvang je een uitgebreid rapport per e-mail. <strong style={{ color: "#d1d5db" }}>Volledig gratis.</strong>
      </p>

      {/* Scan form */}
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
          Gratis scan starten
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="username"
              style={{ display: "block", fontWeight: 600, marginBottom: 6, color: "#d1d5db" }}
            >
              GitHub gebruikersnaam
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
              E-mailadres voor rapport
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jan@voorbeeld.nl"
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
            {status === "scanning" ? "Bezig met scannen..." : "Start gratis scan"}
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
                : status === "queued"
                ? "rgba(59, 130, 246, 0.15)"
                : "rgba(46, 160, 67, 0.15)",
              color: status === "error" ? "#fca5a5" : status === "queued" ? "#93c5fd" : "#86efac",
              border: `1px solid ${status === "error" ? "rgba(220, 38, 38, 0.3)" : status === "queued" ? "rgba(59, 130, 246, 0.3)" : "rgba(46, 160, 67, 0.3)"}`,
            }}
          >
            {message}
          </div>
        )}
      </div>

      {/* What we scan */}
      <div style={{ marginTop: 48, fontSize: 14, color: "#9ca3af" }}>
        <h3 style={{ fontSize: 18, color: "#d1d5db", marginBottom: 16 }}>Wat scannen we?</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
          {[
            {
              title: "Secrets & tokens",
              desc: "AWS-sleutels, GitHub-tokens, privésleutels, API-keys, database-URLs en 20+ andere patronen",
            },
            {
              title: "Kwetsbare dependencies",
              desc: "Bekende CVEs in npm, PyPI, Go en Maven packages via de OSV.dev kwetsbaarheidsdatabase",
            },
            {
              title: "Persoonsgegevens (PII)",
              desc: "BSN, IBAN, e-mailadressen, telefoonnummers, KvK-nummers en postcodes (NL-specifiek)",
            },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                padding: 16,
              }}
            >
              <h4 style={{ color: "#2ea043", margin: "0 0 8px 0", fontSize: 14 }}>{item.title}</h4>
              <p style={{ margin: 0, lineHeight: 1.5, fontSize: 13 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA for organizations */}
      <div
        style={{
          marginTop: 48,
          background: "rgba(46, 160, 67, 0.08)",
          border: "1px solid rgba(46, 160, 67, 0.2)",
          borderRadius: 12,
          padding: 24,
        }}
      >
        <h3 style={{ fontSize: 18, color: "#d1d5db", marginTop: 0, marginBottom: 8 }}>
          Gemeente, ziekenhuis of overheidsinstelling?
        </h3>
        <p style={{ fontSize: 14, color: "#9ca3af", lineHeight: 1.7, marginBottom: 16 }}>
          Publieke code van overheden en zorginstellingen is extra gevoelig. Wij bieden een
          <strong style={{ color: "#d1d5db" }}> gratis diepgaande scan</strong> aan voor organisaties
          in de publieke sector, inclusief maandelijkse rapportage en AI-analyse van bevindingen.
        </p>
        <a
          href="/contact"
          style={{
            display: "inline-block",
            padding: "10px 24px",
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            background: "#2ea043",
            borderRadius: 8,
            textDecoration: "none",
          }}
        >
          Neem contact op
        </a>
      </div>

      {/* Colofon */}
      <footer
        style={{
          marginTop: 60,
          paddingTop: 20,
          borderTop: "1px solid rgba(255, 255, 255, 0.1)",
          fontSize: 12,
          color: "#6b7280",
          lineHeight: 1.8,
        }}
      >
        <p style={{ margin: "0 0 8px 0" }}>
          <strong style={{ color: "#9ca3af" }}>Git Guardian</strong> is een initiatief van{" "}
          <a href="https://publicvibes.nl" style={{ color: "#2ea043" }}>Public Vibes</a> &mdash;
          van idee naar bewijs in uren, niet maanden. Open, soeverein en secure by design.
          Gratis beschikbaar gesteld aan de community. De scan is een hulpmiddel &mdash; geen
          vervanging voor een professionele security audit.
        </p>
        <p style={{ margin: 0 }}>
          Open source onder de{" "}
          <a href="https://eupl.eu/" style={{ color: "#2ea043" }}>EUPL-1.2</a> licentie &mdash;{" "}
          <a href="https://github.com/rwrw01/Git-Guardian" style={{ color: "#2ea043" }}>Broncode op GitHub</a>
          {" "}&mdash;{" "}
          <a href="https://publicvibes.nl" style={{ color: "#2ea043" }}>Public Vibes</a>
          {" "}&mdash;{" "}
          <a href="/contact" style={{ color: "#2ea043" }}>Contact</a>
        </p>
      </footer>
    </main>
  );
}
