"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
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
        }}
      >
        <h1 style={{ fontSize: 28, color: "#fff", marginBottom: 8 }}>
          <span style={{ color: "#2ea043" }}>Git</span> Guardian
        </h1>
        <p style={{ color: "#9ca3af", marginBottom: 32, fontSize: 14 }}>
          Security Operations Portal — Authorized access only
        </p>

        <button
          onClick={() => signIn("github", { callbackUrl: "/admin" })}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            padding: "12px 24px",
            fontSize: 16,
            fontWeight: 600,
            color: "#fff",
            backgroundColor: "#2ea043",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Sign in with GitHub
        </button>

        <p style={{ color: "#6b7280", fontSize: 12, marginTop: 24 }}>
          Access restricted to authorized GitHub accounts.
          <br />
          All actions are logged in the audit trail.
        </p>
      </div>
    </main>
  );
}
