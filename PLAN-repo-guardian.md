# Plan: Security Scanning Tool voor rwrw01 publieke repos

## Context

rwrw01 wil een dagelijkse geautomatiseerde security scan over al zijn publieke GitHub-repositories. Het tool draait op Vercel (cron), scant op secrets/tokens, dependency vulnerabilities, PII-data en gebruikt DeepSeek AI voor diepere analyse. Bij bevindingen wordt een rapport via Resend gemaild.

Daarnaast moet het tool ook beschikbaar zijn als **self-service webpagina** waar vrienden/collega's een eenmalige scan kunnen starten op hun eigen publieke repos. Gebruikers voeren hun GitHub username en e-mailadres in, ontvangen het rapport per email. Deze gegevens worden opgeslagen voor beheer. De self-service scan gebruikt **geen** DeepSeek (kosten/privacy).

Dit wordt een **nieuwe, aparte repository** (niet in golden-rulebook). Het plan wordt hier opgeslagen zodat een nieuwe sessie het kan overnemen.

Gebaseerd op best practices van TruffleHog (800+ patterns, verificatie), Gitleaks (160+ patterns, SARIF output), detect-secrets (entropy + regex + keyword), OSV-Scanner (12+ ecosystemen), en Presidio (NER + regex + checksum voor PII). Nederlandse PII-specifiek: BSN met Elfproef, IBAN met mod-97 checksum.

---

## Projectstructuur (nieuwe repo)

```
repo-guardian/
├── api/
│   ├── scan.ts                    # Vercel cron endpoint — dagelijkse scan (POST)
│   ├── scan-once.ts               # Eenmalige scan endpoint voor webpagina (POST)
│   └── subscribers.ts             # CRUD voor subscriber-lijst (GET/POST/DELETE)
├── src/
│   ├── github.ts                  # GitHub API: list repos, fetch file trees/content
│   ├── secrets.ts                 # Secret/token detection (regex + entropy)
│   ├── dependencies.ts            # Dependency vuln scan via OSV.dev API
│   ├── pii.ts                     # PII detection (BSN/IBAN/email/phone/KvK)
│   ├── deepseek.ts                # DeepSeek API integration voor code-analyse
│   ├── reporter.ts                # Findings aggregatie + severity classificatie
│   ├── email.ts                   # Resend email verzending (Dutch HTML report)
│   ├── patterns.ts                # Alle regex patterns (secrets + PII)
│   ├── subscribers.ts             # Subscriber datastore (Vercel KV / JSON)
│   └── types.ts                   # Gedeelde types, Zod schemas, Result<T>
├── app/
│   └── page.tsx                   # Next.js landing page — scan aanvragen
├── vercel.json                    # Cron config + function settings
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript strict config
├── .env.example                   # Dummy env vars
├── LICENSE                        # EUPL-1.2
└── README.md                      # Documentatie + dependency licentietabel
```

---

## Twee gebruiksmodi

### Modus 1: Dagelijkse cron scan (eigenaar + subscribers)

- Vercel cron triggert `api/scan.ts` dagelijks om 06:00 UTC
- Scant **alle subscribers** in de lijst (rwrw01 + vrienden)
- Per subscriber: alle publieke repos scannen
- **rwrw01 eigen scans**: inclusief DeepSeek AI analyse
- **Subscriber scans**: ZONDER DeepSeek (kosten/privacy)
- Email rapport per subscriber naar hun geregistreerde e-mailadres

### Modus 2: Eenmalige webpagina scan (self-service)

- Gebruiker bezoekt de Vercel URL (landing page)
- Vult in: GitHub username + e-mailadres
- Klikt "Scan starten"
- `api/scan-once.ts` voert scan uit (ZONDER DeepSeek)
- Rapport wordt per email verstuurd via Resend
- GitHub username + e-mailadres worden opgeslagen als subscriber
- Optie om zich af te melden (unsubscribe link in email)

---

## Subscriber beheer

### Datastore: Vercel KV (Redis)
- Key: `subscriber:{github_username}`
- Value: `{ email, githubUsername, createdAt, lastScanAt, isOwner, deepseekEnabled }`
- rwrw01 is `isOwner: true, deepseekEnabled: true`
- Nieuwe subscribers: `isOwner: false, deepseekEnabled: false`

### `src/subscribers.ts`
- `listSubscribers()`: alle subscribers ophalen
- `addSubscriber(username, email)`: toevoegen + deduplicatie
- `removeSubscriber(username)`: verwijderen (unsubscribe)
- `updateLastScan(username)`: timestamp bijwerken
- Zod schema validatie op input

### `api/subscribers.ts`
- `GET`: lijst van subscribers (beveiligd met CRON_SECRET)
- `POST`: subscriber toevoegen (vanuit webpagina)
- `DELETE`: subscriber verwijderen (unsubscribe token)

---

## Environment Variables

```
# Vercel Environment Variables (backend, niet in code)
GITHUB_TOKEN          # GitHub PAT (read-only, public repos)
DEEPSEEK_API_KEY      # DeepSeek API key — alleen in Vercel backend env
RESEND_API_KEY        # Resend API key
SCAN_EMAIL_FROM       # Afzender (bijv. scan@yourdomain.com)
CRON_SECRET           # Vercel cron verification secret
KV_REST_API_URL       # Vercel KV connection
KV_REST_API_TOKEN     # Vercel KV auth

# Git secrets (voor lokaal testen)
# Gebruik: vercel env pull .env.local
```

**Belangrijk**: `DEEPSEEK_API_KEY` staat ALLEEN als Vercel environment variable (backend). Nooit in `.env` file in de repo. Voor lokaal testen: `vercel env pull` haalt deze op in `.env.local` (in `.gitignore`).

---

## Dependencies

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "@vercel/kv": "^2.0.0",
    "resend": "^4.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0"
  }
}
```

Next.js voor de landing page + API routes. Vercel KV voor subscriber opslag. Verder native `fetch()` voor GitHub API, OSV.dev, DeepSeek.

---

## Moduledetails

### 1. `src/types.ts` — Gedeelde types en schemas
- `Finding`: `{ severity, category, repo, file, line, description, impact, fix, reference }`
- `ScanResult`: `Result<Finding[]>` per scan-type
- `Subscriber`: `{ email, githubUsername, createdAt, lastScanAt, isOwner, deepseekEnabled }`
- Severity enum: `CRITICAL | HIGH | MEDIUM | LOW`
- Category enum: `SECRET | DEPENDENCY | PII | CODE_PATTERN`
- Zod schemas voor alle env vars, API responses, subscriber input

### 2. `src/patterns.ts` — Regex patronen
Best practices overgenomen van TruffleHog/Gitleaks/Secrets Patterns DB:

**Secrets (top patterns):**
- AWS Access Key: `AKIA[0-9A-Z]{16}`
- AWS Secret Key: `(?i)aws_secret_access_key\s*=\s*[A-Za-z0-9/+=]{40}`
- GitHub Token: `gh[pousr]_[A-Za-z0-9_]{36,255}`
- Generic API Key: `(?i)(api[_-]?key|apikey)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{20,}`
- Private Key: `-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----`
- Generic Secret: `(?i)(secret|password|passwd|token)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{8,}`
- Slack Token/Webhook, Google API Key, Stripe Key, JWT, etc.

**PII (Nederlands):**
- BSN: 9-cijferig + Elfproef validatie
- IBAN: `NL\d{2}[A-Z]{4}\d{10}` + mod-97 checksum
- Email: standaard RFC 5322 pattern
- Telefoon: `(?:\+31|0)[1-9]\d{8}` (NL formaat)
- KvK: 8-cijferig nummer
- Postcode: `[1-9]\d{3}\s?[A-Z]{2}`

### 3. `src/github.ts` — GitHub API interactie
- `listPublicRepos(username)`: GET `/users/{username}/repos?type=public`
- `getRepoTree(owner, repo)`: GET `/repos/{owner}/{repo}/git/trees/HEAD?recursive=1`
- `getFileContent(owner, repo, path)`: GET `/repos/{owner}/{repo}/contents/{path}`
- Filter: alleen tekstbestanden, skip binaries/images, max 1MB per file
- Rate limit aware: check `x-ratelimit-remaining` header

### 4. `src/secrets.ts` — Secret detectie
- Scan alle tekstbestanden tegen patronen uit `patterns.ts`
- Entropy check (Shannon entropy) voor high-entropy strings als extra signaal
- Skip: `.env.example`, `*test*`, `*mock*`, bekende false positives
- Per match: file, line number, type, gemaskeerde waarde

### 5. `src/dependencies.ts` — Dependency vulnerabilities
- Parse `package.json`, `requirements.txt`, `Gemfile.lock`, `go.sum`, `pom.xml`
- Query OSV.dev API: `POST https://api.osv.dev/v1/querybatch`
- Batch queries per ecosystem (npm, PyPI, Go, Maven)
- Filter op severity: alleen CRITICAL en HIGH rapporteren
- Inclusief: CVE ID, CVSS score, affected versions, fix versie

### 6. `src/pii.ts` — PII detectie
Gebaseerd op Presidio patterns + Nederlandse specifics:
- BSN detectie met Elfproef algoritme (niet alleen regex)
- IBAN detectie met mod-97 checksum validatie
- Email, telefoon, KvK, postcode patronen
- Context-aware: skip test files, skip comments met "voorbeeld"/"example"

### 7. `src/deepseek.ts` — DeepSeek AI analyse
- POST naar `https://api.deepseek.com/v1/chat/completions`
- Model: `deepseek-chat`
- API key komt ALLEEN uit Vercel backend environment (`process.env.DEEPSEEK_API_KEY`)
- Stuur samenvatting van gevonden patronen + code context
- Prompt: analyseer verdachte patronen, identificeer false positives, suggereer extra risico's
- Gebruik voor: complexe patronen die regex mist (hardcoded credentials in variabelen, encoded secrets)
- Max 4000 tokens input, 1000 tokens output per call
- **Alleen voor isOwner subscribers** (niet voor self-service scans)

### 8. `src/reporter.ts` — Rapport generatie
Rapport structuur (Nederlands, conform CLAUDE.md):
1. **Management samenvatting**: totaal repos, totaal bevindingen per severity
2. **Kritieke bevindingen** (CRITICAL + HIGH)
3. **Medium bevindingen**
4. **Lage bevindingen**
5. **Actielijst**: prioriteit, eigenaar, deadline suggestie
6. **Maturity score**: 1-5 per categorie (secrets, dependencies, PII)

### 9. `src/email.ts` — Resend email verzending
- HTML email template (Dutch)
- Alleen versturen als er bevindingen zijn (geen spam bij clean scan)
- Subject: `[Repo Guardian] {aantal} bevindingen in {aantal} repositories — {datum}`
- Severity kleuren: rood (CRITICAL), oranje (HIGH), geel (MEDIUM), blauw (LOW)
- Unsubscribe link onderaan elke email

### 10. `api/scan.ts` — Dagelijkse cron endpoint
- Verificatie van `CRON_SECRET` header
- Haal alle subscribers op uit Vercel KV
- Per subscriber: repos ophalen → parallel scannen → (optioneel DeepSeek) → rapport → email
- Vercel function timeout: `maxDuration: 300` (Pro plan, 5 min)
- Scan subscribers sequentieel, repos per subscriber parallel
- Structured JSON logging naar stdout

### 11. `api/scan-once.ts` — Eenmalige scan endpoint
- POST met `{ githubUsername, email }`
- Zod validatie op input
- Rate limiting: max 1 scan per email per uur
- Scan uitvoeren ZONDER DeepSeek
- Sla subscriber op in Vercel KV
- Stuur rapport per email
- Return: `{ status: "scanning" | "complete", message: string }`

### 12. `app/page.tsx` — Landing page
- Simpele Next.js pagina met formulier
- Velden: GitHub username, e-mailadres
- "Start scan" knop
- Uitleg wat er gescand wordt (secrets, dependencies, PII)
- Privacy notice: welke data we opslaan en waarom
- NL Design System styling (indien beschikbaar) of minimale Tailwind

---

## vercel.json

```json
{
  "crons": [
    {
      "path": "/api/scan",
      "schedule": "0 6 * * *"
    }
  ],
  "functions": {
    "api/scan.ts": {
      "maxDuration": 300
    },
    "api/scan-once.ts": {
      "maxDuration": 120
    }
  }
}
```

Dagelijkse cron om 06:00 UTC. Eenmalige scans max 2 minuten.

---

## Scanstrategie (per repo)

1. Haal file tree op via GitHub API (geen clone nodig)
2. Filter relevante bestanden (skip binaries, node_modules, .git, images)
3. Parallel: secrets scan + PII scan op tekstbestanden
4. Parallel: dependency scan op manifest files
5. Aggregeer findings
6. **Alleen voor owner**: als findings > 0 → DeepSeek analyse/verificatie
7. DeepSeek markeert false positives en voegt context toe
8. Genereer rapport, verstuur email

---

## Best practices overgenomen van bestaande tools

| Van | Best practice | Implementatie |
|-----|--------------|---------------|
| TruffleHog | Verificatie van gevonden secrets | DeepSeek analyseert of secret echt/actief lijkt |
| Gitleaks | SARIF-compatible output | Finding type volgt SARIF structuur |
| detect-secrets | Entropy + regex combo | Shannon entropy als extra signaal naast patronen |
| OSV-Scanner | Batch queries | Eén batch call per ecosystem i.p.v. per package |
| Presidio | Checksum validatie | Elfproef (BSN) + mod-97 (IBAN) |
| Semgrep | Context-aware scanning | Skip test/mock bestanden, analyseer omgeving |
| Secrets Patterns DB | 1600+ patronen | Top-50 meest voorkomende patronen selectie |

---

## Beveiligingsmaatregelen

- `DEEPSEEK_API_KEY` alleen als Vercel backend env var, nooit client-side
- `CRON_SECRET` verificatie op cron endpoint
- Rate limiting op scan-once endpoint (1 per email per uur)
- Input validatie met Zod op alle endpoints
- Unsubscribe token per subscriber (signed, niet raadbaar)
- Geen PII/secrets in logs (gemaskeerd)
- CORS restrictie op API routes

---

## Verificatie

1. `npx tsc --noEmit` — type check
2. Lokaal testen: `vercel dev` → formulier invullen → email ontvangen
3. Test cron: `curl -X POST http://localhost:3000/api/scan -H "authorization: Bearer {CRON_SECRET}"`
4. Deploy naar Vercel, check cron logs
5. Verifieer email ontvangst bij bevindingen
6. Test met een test-repo die bekende patterns bevat
7. Test unsubscribe flow
