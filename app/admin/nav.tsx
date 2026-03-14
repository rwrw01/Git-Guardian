"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/scans", label: "Scan History" },
  { href: "/admin/subscribers", label: "Subscribers" },
  { href: "/admin/false-positives", label: "False Positives" },
  { href: "/admin/audit", label: "Audit Log" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminNav({ username }: { username: string }) {
  const pathname = usePathname();

  return (
    <nav
      style={{
        width: 220,
        background: "#252526",
        borderRight: "1px solid #3c3c3c",
        padding: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Title bar */}
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #3c3c3c" }}>
        <Link href="/admin" style={{ textDecoration: "none" }}>
          <h2 style={{ fontSize: 14, color: "#cccccc", margin: 0, fontWeight: 400 }}>
            <span style={{ color: "#2ea043", fontWeight: 600 }}>GIT</span> GUARDIAN
          </h2>
        </Link>
        <p style={{ fontSize: 10, color: "#858585", margin: "2px 0 0", textTransform: "uppercase", letterSpacing: 1.5 }}>
          Security Operations
        </p>
      </div>

      {/* Explorer label */}
      <div style={{ padding: "8px 16px 4px", fontSize: 11, color: "#858585", textTransform: "uppercase", letterSpacing: 1 }}>
        Explorer
      </div>

      {/* Nav items */}
      <div style={{ flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "block",
                padding: "6px 16px 6px 24px",
                fontSize: 13,
                color: active ? "#ffffff" : "#cccccc",
                textDecoration: "none",
                backgroundColor: active ? "#094771" : "transparent",
                fontWeight: 400,
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Status bar */}
      <div
        style={{
          padding: "6px 16px",
          background: "#007acc",
          fontSize: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ color: "#ffffff", fontSize: 11 }}>{username}</span>
        <button
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          style={{
            background: "none",
            border: "none",
            color: "#ffffff",
            fontSize: 11,
            cursor: "pointer",
            textDecoration: "underline",
            padding: 0,
          }}
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
