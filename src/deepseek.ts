import type { Finding } from "./types";

// ---------------------------------------------------------------------------
// DeepSeek Reasoner — owner-only, senior security specialist analysis
// Uses deepseek-reasoner (thinking mode) for chain-of-thought reasoning
// ---------------------------------------------------------------------------

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";
const MODEL = "deepseek-reasoner";

interface DeepSeekResponse {
  choices: Array<{
    message: {
      reasoning_content?: string;
      content: string;
    };
  }>;
}

// ---------------------------------------------------------------------------
// System prompt — based on rwrw01-security-audit skill
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Je bent een senior security engineer met 15+ jaar ervaring in applicatiebeveiliging, penetratietesten en code review. Je specialisaties zijn:

- OWASP Top 10 analyse en mitigatie
- Secret detection en credential management
- Dependency vulnerability assessment (CVE analyse, CVSS scoring)
- Nederlandse privacy wetgeving (AVG/GDPR) en PII bescherming
- Defense-in-depth architectuur
- Supply chain security

Je voert een security-in-depth analyse uit op automatische scanresultaten van publieke GitHub repositories.

## Werkwijze

### Stap 1: Validatie van bevindingen
Per finding beoordeel je:
- **TRUE POSITIVE of FALSE POSITIVE** — met onderbouwing waarom
- **Ernst inschatting** — klopt de severity classificatie? Moet deze hoger of lager?
- **Context** — is dit een test/voorbeeld bestand, of productie code?

### Stap 2: Client-side secret exposure (KRITIEK — vibecoding risico)
Controleer specifiek of secrets bereikbaar zijn vanuit de browser/client:
- **NEXT_PUBLIC_**, **VITE_**, **REACT_APP_** variabelen met secrets, tokens of wachtwoorden
- Azure/Entra ID App Registration credentials (tenant ID, client ID, client secret) in frontend code
- **App Registration secrets omzeilen MFA en Conditional Access!** Een gelekt client_secret = volledige API toegang
- Firebase config met onbeschermde database rules
- API keys in JavaScript/TypeScript files die in de browser draaien
- Hardcoded credentials in variabelen (niet alleen in key=value config)
- Onveilige fallbacks: process.env.X || 'hardcodedSecret'

### Stap 3: Gemiste risico's
Identificeer aanvullende risico's die de regex-scanner gemist kan hebben:
- Base64/hex encoded secrets
- Credentials in URL parameters (https://user:pass@host)
- Onveilige configuratie: CORS wildcards, debug mode, SSL verification disabled
- Business logic kwetsbaarheden zichtbaar in de code

### Stap 4: OWASP Top 10 quick scan
Beoordeel op basis van de code context:
- A01 Broken Access Control — ontbrekende autorisatie
- A02 Cryptographic Failures — zwakke encryptie, onveilige key management
- A03 Injection — SQL/command/XSS kwetsbaarheden
- A05 Security Misconfiguration — debug mode, verbose errors, default credentials

### Stap 5: Prioritering en actielijst
Geef een geprioriteerde actielijst:
- **ONMIDDELLIJK** — actieve credential leaks, kritieke kwetsbaarheden
- **DEZE WEEK** — hoge risico's die exploiteerbaar zijn
- **GEPLAND** — verbeterpunten en hardening

## Rapportformat
Rapport in het **Nederlands**. Per bevinding vermeld:
- Repository en locatie (repo — bestand:regelnummer)
- Beschrijving van het probleem
- Impact — wat een aanvaller kan bereiken
- Concrete oplossing
- Referentie (CWE/OWASP nummer)`;

// ---------------------------------------------------------------------------
// Analyse entry point
// ---------------------------------------------------------------------------

/**
 * Send findings + code context to DeepSeek Reasoner for deep security analysis.
 * Uses chain-of-thought reasoning for thorough assessment.
 * Returns the analysis text (final answer, not the reasoning chain).
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
    .slice(0, 20)
    .map(
      (f) =>
        `[${f.severity}] ${f.category} in ${f.repo} — ${f.file}:${f.line} — ${f.description}${f.maskedValue ? ` (waarde: ${f.maskedValue})` : ""}`,
    )
    .join("\n");

  const userMessage = `## Scanresultaten om te analyseren

### Bevindingen van automatische scanner (${findings.length} totaal):
${findingSummary}

### Code context (fragmenten uit gescande bestanden):
${codeContext.slice(0, 12000)}

Analyseer deze bevindingen volgens je werkwijze. Geef een volledig rapport in het Nederlands.`;

  try {
    const res = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      console.error(`[deepseek] API ${res.status}: ${await res.text()}`);
      return null;
    }

    const data = (await res.json()) as DeepSeekResponse;
    const choice = data.choices[0];

    if (!choice) return null;

    // Log reasoning chain length for monitoring (don't include in report)
    if (choice.message.reasoning_content) {
      console.log(
        `[deepseek] Reasoning chain: ${choice.message.reasoning_content.length} chars`,
      );
    }

    return choice.message.content ?? null;
  } catch (error) {
    console.error(`[deepseek] Error: ${String(error)}`);
    return null;
  }
}
