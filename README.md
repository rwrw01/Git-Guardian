# Git Guardian

Geautomatiseerde security scanner voor publieke GitHub-repositories. Scant dagelijks op secrets/tokens, dependency vulnerabilities en PII-data. Draait op Vercel (cron) met optionele DeepSeek AI-analyse voor diepere inspectie. Rapporten worden per e-mail verstuurd via Resend.

Ook beschikbaar als **self-service webpagina** waar collega's een eenmalige scan kunnen starten op hun eigen publieke repos.

## Kenmerken

- **Secret detectie** — regex + Shannon entropy, gebaseerd op best practices van TruffleHog, Gitleaks en detect-secrets
- **Dependency scanning** — kwetsbaarheden opsporen via OSV.dev API (npm, PyPI, Go, Maven)
- **PII detectie** — BSN (Elfproef), IBAN (mod-97), e-mail, telefoon, KvK, postcode
- **DeepSeek AI analyse** — optionele diepere code-analyse (alleen voor eigenaar)
- **Dagelijkse cron** — automatische scan om 06:00 UTC via Vercel cron
- **Self-service** — webpagina voor eenmalige scans, rapport per e-mail
- **Subscriber beheer** — Vercel KV opslag, unsubscribe via e-maillink

## Projectstructuur

```
git-guardian/
├── api/
│   ├── scan.ts              # Vercel cron endpoint — dagelijkse scan
│   ├── scan-once.ts         # Eenmalige scan endpoint voor webpagina
│   └── subscribers.ts       # CRUD voor subscriber-lijst
├── src/
│   ├── github.ts            # GitHub API: repos, file trees, content
│   ├── secrets.ts           # Secret/token detectie (regex + entropy)
│   ├── dependencies.ts      # Dependency vuln scan via OSV.dev API
│   ├── pii.ts               # PII detectie (BSN/IBAN/email/phone/KvK)
│   ├── deepseek.ts          # DeepSeek AI integratie
│   ├── reporter.ts          # Findings aggregatie + severity classificatie
│   ├── email.ts             # Resend e-mail verzending (NL HTML rapport)
│   ├── patterns.ts          # Alle regex patterns (secrets + PII)
│   ├── subscribers.ts       # Subscriber datastore (Vercel KV)
│   └── types.ts             # Gedeelde types, Zod schemas
├── app/
│   └── page.tsx             # Next.js landing page — scan aanvragen
├── vercel.json              # Cron config + function settings
├── package.json
├── tsconfig.json
├── .env.example
├── LICENSE                  # EUPL-1.2
└── README.md
```

## Bouwen

### Vereisten

- Node.js >= 20
- npm of pnpm
- Vercel account (voor deploy, KV en cron)
- GitHub PAT (read-only, public repos)
- Resend account + API key
- DeepSeek API key (optioneel, alleen voor eigenaar-scans)

### Installatie

```bash
git clone https://github.com/rwrw01/Git-Guardian.git
cd Git-Guardian
npm install
```

### Environment variables

Kopieer het voorbeeldbestand en vul de waarden in:

```bash
cp .env.example .env.local
```

| Variabele | Doel |
|-----------|------|
| `GITHUB_TOKEN` | GitHub PAT (read-only, public repos) |
| `DEEPSEEK_API_KEY` | DeepSeek API key (alleen Vercel backend, nooit client-side) |
| `RESEND_API_KEY` | Resend API key |
| `SCAN_EMAIL_FROM` | Afzender e-mailadres |
| `CRON_SECRET` | Vercel cron verificatie secret |
| `KV_REST_API_URL` | Vercel KV connectie-URL |
| `KV_REST_API_TOKEN` | Vercel KV auth token |

Voor lokaal testen met Vercel KV: `vercel env pull .env.local`

### Lokaal draaien

```bash
vercel dev
```

### Type check

```bash
npx tsc --noEmit
```

### Testen

```bash
# Eenmalige scan via API
curl -X POST http://localhost:3000/api/scan-once \
  -H "Content-Type: application/json" \
  -d '{"githubUsername": "jouw-username", "email": "jouw@email.nl"}'

# Cron simuleren
curl -X POST http://localhost:3000/api/scan \
  -H "authorization: Bearer ${CRON_SECRET}"
```

### Deployen

```bash
vercel deploy --prod
```

Vercel cron draait automatisch dagelijks om 06:00 UTC na deploy.

## Dependencies en licenties

### Runtime dependencies

| Package | Versie | Licentie | Doel |
|---------|--------|----------|------|
| [next](https://github.com/vercel/next.js) | ^15.0.0 | MIT | Framework: landing page + API routes |
| [@vercel/kv](https://github.com/vercel/storage) | ^2.0.0 | Apache-2.0 | Subscriber opslag (Redis) |
| [resend](https://github.com/resendlabs/resend-node) | ^4.0.0 | MIT | E-mail verzending van scanrapporten |
| [zod](https://github.com/colinhacks/zod) | ^3.23.0 | MIT | Schema validatie voor input en env vars |

### Dev dependencies

| Package | Versie | Licentie | Doel |
|---------|--------|----------|------|
| [typescript](https://github.com/microsoft/TypeScript) | ^5.5.0 | Apache-2.0 | TypeScript compiler |
| [@types/node](https://github.com/DefinitelyTyped/DefinitelyTyped) | ^22.0.0 | MIT | Node.js type definities |
| [@types/react](https://github.com/DefinitelyTyped/DefinitelyTyped) | ^19.0.0 | MIT | React type definities |

### Externe API's en services

| Service | Doel | Kosten |
|---------|------|--------|
| [GitHub REST API](https://docs.github.com/en/rest) | Repos en bestanden ophalen | Gratis (rate limited) |
| [OSV.dev API](https://osv.dev/) | Dependency vulnerability database | Gratis, open source (Apache-2.0) |
| [DeepSeek API](https://platform.deepseek.com/) | AI-analyse van verdachte patronen | Betaald, alleen eigenaar-scans |
| [Resend](https://resend.com/) | E-mail verzending | Gratis tier beschikbaar |
| [Vercel](https://vercel.com/) | Hosting, cron, KV (Redis) | Pro plan voor 5 min function timeout |

### Inspiratiebronnen (geen directe dependencies)

Onze scanpatronen en -strategieen zijn gebaseerd op best practices van:

| Tool | Licentie | Wat we overnemen |
|------|----------|------------------|
| [TruffleHog](https://github.com/trufflesecurity/trufflehog) | AGPL-3.0 | Verificatie-strategie voor gevonden secrets |
| [Gitleaks](https://github.com/gitleaks/gitleaks) | MIT | SARIF-compatibele finding structuur |
| [detect-secrets](https://github.com/Yelp/detect-secrets) | Apache-2.0 | Entropy + regex combinatie-aanpak |
| [OSV-Scanner](https://github.com/google/osv-scanner) | Apache-2.0 | Batch queries per ecosystem |
| [Presidio](https://github.com/microsoft/presidio) | MIT | Checksum validatie (Elfproef, mod-97) |
| [Semgrep](https://github.com/semgrep/semgrep) | LGPL-2.1 | Context-aware scanning (skip test/mock) |
| [Secrets Patterns DB](https://github.com/mazen160/secrets-patterns-db) | CC-BY-4.0 | Patronen-database als referentie |

### Gerelateerde repository

| Repository | Doel | Licentie |
|------------|------|----------|
| [rwrw01/golden-rulebook](https://github.com/rwrw01/golden-rulebook) | Coding standards, rules en audit skills (bron van `.claude/` config) | EUPL-1.2 |

## Licentie

EUPL-1.2 — zie [LICENSE](LICENSE)
