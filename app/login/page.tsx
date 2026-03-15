"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const ERROR_MESSAGES: Record<string, string> = {
  "missing-token": "Ongeldige link — vraag een nieuwe inloglink aan.",
  "invalid-token": "Link verlopen of ongeldig — vraag een nieuwe inloglink aan.",
  config: "Serverconfiguratiefout — neem contact op met de beheerder.",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setStatus("error");
        setMessage(data.error ?? "Er ging iets mis");
        return;
      }

      setStatus("sent");
      setMessage("Inloglink verstuurd! Controleer je inbox (en spammap).");
    } catch {
      setStatus("error");
      setMessage("Netwerkfout — probeer opnieuw.");
    }
  }

  return (
    <>
      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.4)",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 24,
            fontSize: 13,
            color: "#fca5a5",
            textAlign: "left",
          }}
        >
          {ERROR_MESSAGES[error] ?? "Er is een fout opgetreden."}
        </div>
      )}

      {status === "sent" ? (
        <div
          style={{
            background: "rgba(46,160,67,0.15)",
            border: "1px solid rgba(46,160,67,0.4)",
            borderRadius: 8,
            padding: "16px",
            fontSize: 14,
            color: "#86efac",
            textAlign: "left",
          }}
        >
          {message}
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="email"
              style={{ display: "block", fontWeight: 600, marginBottom: 6, color: "#d1d5db", fontSize: 13 }}
            >
              E-mailadres
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@voorbeeld.nl"
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 16,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                boxSizing: "border-box",
                color: "#fff",
                outline: "none",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={status === "sending"}
            style={{
              width: "100%",
              padding: "12px",
              fontSize: 16,
              fontWeight: 600,
              color: "#fff",
              backgroundColor: status === "sending" ? "rgba(255,255,255,0.15)" : "#2ea043",
              border: "none",
              borderRadius: 8,
              cursor: status === "sending" ? "not-allowed" : "pointer",
            }}
          >
            {status === "sending" ? "Versturen..." : "Stuur inloglink"}
          </button>

          {status === "error" && message && (
            <div style={{ marginTop: 12, fontSize: 13, color: "#fca5a5" }}>
              {message}
            </div>
          )}
        </form>
      )}
    </>
  );
}

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1e1e1e",
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12,
          padding: 48,
          textAlign: "center",
          maxWidth: 400,
          width: "100%",
          margin: "0 16px",
        }}
      >
        <h1 style={{ fontSize: 28, color: "#fff", marginBottom: 8 }}>
          <span style={{ color: "#2ea043" }}>Git</span> Guardian
        </h1>
        <p style={{ color: "#9ca3af", marginBottom: 32, fontSize: 14 }}>
          Security Operations Portal — Alleen geautoriseerde toegang
        </p>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

        <p style={{ color: "#6b7280", fontSize: 12, marginTop: 24 }}>
          We sturen een eenmalige inloglink naar je e-mailadres.
          <br />
          Alleen geautoriseerde adressen krijgen toegang.
        </p>
      </div>
    </main>
  );
}
