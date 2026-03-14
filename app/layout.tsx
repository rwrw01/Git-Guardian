import type { Metadata } from "next";

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
          backgroundColor: "#f9fafb",
          color: "#1f2937",
        }}
      >
        {children}
      </body>
    </html>
  );
}
