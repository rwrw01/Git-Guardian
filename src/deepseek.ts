import type { Finding } from "./types";

// ---------------------------------------------------------------------------
// DeepSeek AI analysis — owner-only, for deeper code inspection
// ---------------------------------------------------------------------------

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";
const MODEL = "deepseek-chat";
const MAX_INPUT_TOKENS = 4000;
const MAX_OUTPUT_TOKENS = 1000;

interface DeepSeekResponse {
  choices: Array<{
    message: { content: string };
  }>;
}

/**
 * Send findings + code context to DeepSeek for verification and deeper analysis.
 * Returns enriched analysis text to append to the report.
 * Returns null if DeepSeek is not configured or the call fails.
 */
export async function analyzeWithDeepSeek(
  findings: Finding[],
  codeContext: string,
): Promise<string | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  if (findings.length === 0) return null;

  const findingSummary = findings
    .slice(0, 20) // Limit to top 20 findings
    .map(
      (f) =>
        `[${f.severity}] ${f.category} in ${f.file}:${f.line} — ${f.description}`,
    )
    .join("\n");

  // Truncate code context to fit token budget
  const truncatedContext = codeContext.slice(0, MAX_INPUT_TOKENS * 3);

  const prompt = `You are a security analyst reviewing scan results for a public GitHub repository.

## Findings from automated scan:
${findingSummary}

## Code context (excerpts):
${truncatedContext}

## Your task:
1. For each finding, assess if it is a TRUE POSITIVE or likely FALSE POSITIVE. Explain why.
2. Identify any ADDITIONAL risks the regex-based scanner may have missed (hardcoded credentials in variables, encoded secrets, suspicious patterns).
3. Prioritize: which findings need IMMEDIATE action?

Respond in a structured format. Be concise. Focus on actionable advice.`;

  try {
    const res = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      console.error(`[deepseek] API ${res.status}: ${await res.text()}`);
      return null;
    }

    const data = (await res.json()) as DeepSeekResponse;
    return data.choices[0]?.message?.content ?? null;
  } catch (error) {
    console.error(`[deepseek] Error: ${String(error)}`);
    return null;
  }
}
