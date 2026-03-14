"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const ERROR_MESSAGES: Record<string, string> = {
  Configuration:
    "Server configuration error — check that AUTH_SECRET, GITHUB_CLIENT_ID, and GITHUB_CLIENT_SECRET are set in Vercel environment variables.",
  AccessDenied:
    "Access denied — your GitHub account is not in the ADMIN_GITHUB_USERS allowlist.",
  Default: "An authentication error occurred. Please try again.",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

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
          {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default}
        </div>
      )}

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
        }}
      >
        <h1 style={{ fontSize: 28, color: "#fff", marginBottom: 8 }}>
          <span style={{ color: "#2ea043" }}>Git</span> Guardian
        </h1>
        <p style={{ color: "#9ca3af", marginBottom: 32, fontSize: 14 }}>
          Security Operations Portal — Authorized access only
        </p>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

        <p style={{ color: "#6b7280", fontSize: 12, marginTop: 24 }}>
          Access restricted to authorized GitHub accounts.
          <br />
          All actions are logged in the audit trail.
        </p>
      </div>
    </main>
  );
}
