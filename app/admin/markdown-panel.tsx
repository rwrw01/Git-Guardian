"use client";

import Markdown from "react-markdown";

interface MarkdownPanelProps {
  content: string;
  maxHeight?: number;
}

export function MarkdownPanel({ content, maxHeight = 500 }: MarkdownPanelProps) {
  return (
    <div
      className="markdown-panel"
      style={{
        fontSize: 13,
        color: "#cccccc",
        lineHeight: 1.7,
        maxHeight,
        overflow: "auto",
        background: "#1e1e1e",
        padding: "12px 16px",
        borderRadius: 4,
      }}
    >
      <Markdown
        components={{
          h1: ({ children }) => <h1 style={{ fontSize: 18, color: "#fff", borderBottom: "1px solid #3c3c3c", paddingBottom: 6, marginTop: 20 }}>{children}</h1>,
          h2: ({ children }) => <h2 style={{ fontSize: 16, color: "#e2c08d", marginTop: 20, marginBottom: 8 }}>{children}</h2>,
          h3: ({ children }) => <h3 style={{ fontSize: 14, color: "#9cdcfe", marginTop: 16, marginBottom: 6 }}>{children}</h3>,
          p: ({ children }) => <p style={{ margin: "8px 0" }}>{children}</p>,
          ul: ({ children }) => <ul style={{ paddingLeft: 20, margin: "4px 0" }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ paddingLeft: 20, margin: "4px 0" }}>{children}</ol>,
          li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
          strong: ({ children }) => <strong style={{ color: "#fff" }}>{children}</strong>,
          em: ({ children }) => <em style={{ color: "#ce9178" }}>{children}</em>,
          code: ({ children, className }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <pre style={{ background: "#0d1117", padding: 12, borderRadius: 4, overflow: "auto", fontSize: 12, margin: "8px 0" }}>
                  <code style={{ color: "#e6edf3" }}>{children}</code>
                </pre>
              );
            }
            return <code style={{ background: "#2d2d2d", padding: "1px 5px", borderRadius: 3, fontSize: 12, color: "#ce9178" }}>{children}</code>;
          },
          pre: ({ children }) => <>{children}</>,
          hr: () => <hr style={{ border: "none", borderTop: "1px solid #3c3c3c", margin: "16px 0" }} />,
          table: ({ children }) => (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, margin: "8px 0" }}>{children}</table>
          ),
          th: ({ children }) => (
            <th style={{ padding: "6px 8px", borderBottom: "1px solid #3c3c3c", color: "#858585", textAlign: "left", fontWeight: 600 }}>{children}</th>
          ),
          td: ({ children }) => (
            <td style={{ padding: "6px 8px", borderBottom: "1px solid #2d2d2d" }}>{children}</td>
          ),
          a: ({ children, href }) => (
            <a href={href} style={{ color: "#2ea043" }} target="_blank" rel="noopener noreferrer">{children}</a>
          ),
          blockquote: ({ children }) => (
            <blockquote style={{ borderLeft: "3px solid #3c3c3c", paddingLeft: 12, margin: "8px 0", color: "#858585" }}>{children}</blockquote>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
