import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Git Guardian — Security Scanner",
  description:
    "Automated security scanning for your public GitHub repositories. Detects secrets, dependency vulnerabilities, and PII.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "linear-gradient(135deg, #1a2332 0%, #152420 50%, #132b1e 100%)",
          color: "#e5e7eb",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
