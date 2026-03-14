"use client";

import { useState } from "react";

type Status = "idle" | "sending" | "done" | "error";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [messageText, setMessageText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [feedback, setFeedback] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setFeedback("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, organisation, message: messageText }),
      });

      if (res.ok) {
        setStatus("done");
        setFeedback("Bedankt voor je bericht! We nemen zo snel mogelijk contact op.");
        setName("");
        setEmail("");
        setOrganisation("");
        setMessageText("");
      } else {
        const data = await res.json();
        setStatus("error");
        setFeedback(data.error ?? "Er ging iets mis. Probeer het opnieuw.");
      }
    } catch {
      setStatus("error");
      setFeedback("Netwerkfout. Probeer het opnieuw.");
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    fontSize: 16,
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    borderRadius: 8,
    boxSizing: "border-box" as const,
    color: "#fff",
    outline: "none",
  };

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "60px 20px" }}>
      <a href="/" style={{ color: "#2ea043", fontSize: 14, textDecoration: "none" }}>
        &larr; Terug naar Git Guardian
      </a>

      <h1 style={{ fontSize: 36, marginTop: 24, marginBottom: 8, color: "#fff" }}>
        Contact
      </h1>
      <p style={{ fontSize: 16, color: "#9ca3af", marginBottom: 32, lineHeight: 1.7 }}>
        Bent u een gemeente, ziekenhuis, waterschap of andere publieke instelling?
        Neem contact op voor een gratis diepgaande security scan van uw publieke
        repositories, inclusief maandelijkse rapportage en AI-analyse.
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
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="name" style={{ display: "block", fontWeight: 600, marginBottom: 6, color: "#d1d5db" }}>
              Naam
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jan de Vries"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="contact-email" style={{ display: "block", fontWeight: 600, marginBottom: 6, color: "#d1d5db" }}>
              E-mailadres
            </label>
            <input
              id="contact-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="j.devries@gemeente.nl"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="org" style={{ display: "block", fontWeight: 600, marginBottom: 6, color: "#d1d5db" }}>
              Organisatie
            </label>
            <input
              id="org"
              type="text"
              value={organisation}
              onChange={(e) => setOrganisation(e.target.value)}
              placeholder="Gemeente Amsterdam"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label htmlFor="msg" style={{ display: "block", fontWeight: 600, marginBottom: 6, color: "#d1d5db" }}>
              Bericht
            </label>
            <textarea
              id="msg"
              required
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Beschrijf kort wat u zoekt, bijvoorbeeld: scan van onze GitHub organisatie, maandelijkse rapportage, etc."
              rows={5}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
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
            {status === "sending" ? "Verzenden..." : "Verstuur bericht"}
          </button>
        </form>

        {feedback && (
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
            {feedback}
          </div>
        )}
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
        Git Guardian &mdash; een project van Ralph Wagter &mdash; EUPL-1.2
      </footer>
    </main>
  );
}
