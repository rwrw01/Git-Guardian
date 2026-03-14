# Git Guardian

Automated security scanner for public GitHub repositories. Runs daily scans for secrets/tokens, dependency vulnerabilities, and PII data via Vercel cron. Optionally uses DeepSeek AI for deeper code analysis. Reports are delivered by email via Resend.

Also available as a **self-service web page** where colleagues can trigger a one-time scan on their own public repos.

## Features

- **Secret detection** — regex + Shannon entropy, based on best practices from TruffleHog, Gitleaks, and detect-secrets
- **Dependency scanning** — vulnerability lookup via OSV.dev API (npm, PyPI, Go, Maven)
- **PII detection** — Dutch-specific: BSN (11-check), IBAN (mod-97), email, phone, KvK, postal code
- **DeepSeek AI analysis** — optional deep code analysis (owner-only)
- **Daily cron** — automatic scan at 06:00 UTC via Vercel cron
- **Self-service** — web page for one-time scans, report delivered by email
- **Subscriber management** — Vercel KV storage, unsubscribe via email link

## Project structure

```
git-guardian/
├── api/
│   ├── scan.ts              # Vercel cron endpoint — daily scan
│   ├── scan-once.ts         # One-time scan endpoint for web page
│   └── subscribers.ts       # CRUD for subscriber list
├── src/
│   ├── github.ts            # GitHub API: repos, file trees, content
│   ├── secrets.ts           # Secret/token detection (regex + entropy)
│   ├── dependencies.ts      # Dependency vuln scan via OSV.dev API
│   ├── pii.ts               # PII detection (BSN/IBAN/email/phone/KvK)
│   ├── deepseek.ts          # DeepSeek AI integration
│   ├── reporter.ts          # Findings aggregation + severity classification
│   ├── email.ts             # Resend email delivery (Dutch HTML report)
│   ├── patterns.ts          # All regex patterns (secrets + PII)
│   ├── subscribers.ts       # Subscriber datastore (Vercel KV)
│   └── types.ts             # Shared types, Zod schemas
├── app/
│   └── page.tsx             # Next.js landing page — request a scan
├── vercel.json              # Cron config + function settings
├── package.json
├── tsconfig.json
├── .env.example
├── LICENSE                  # EUPL-1.2
└── README.md
```

## Build

### Prerequisites

- Node.js >= 20
- npm or pnpm
- Vercel account (for deploy, KV, and cron)
- GitHub PAT (read-only, public repos)
- Resend account + API key
- DeepSeek API key (optional, owner-scans only)

### Installation

```bash
git clone https://github.com/rwrw01/Git-Guardian.git
cd Git-Guardian
npm install
```

### Environment variables

Copy the example file and fill in the values:

```bash
cp .env.example .env.local
```

| Variable | Purpose |
|----------|---------|
| `GITHUB_TOKEN` | GitHub PAT (read-only, public repos) |
| `DEEPSEEK_API_KEY` | DeepSeek API key (Vercel backend only, never client-side) |
| `RESEND_API_KEY` | Resend API key |
| `SCAN_EMAIL_FROM` | Sender email address |
| `CRON_SECRET` | Vercel cron verification secret |
| `KV_REST_API_URL` | Vercel KV connection URL |
| `KV_REST_API_TOKEN` | Vercel KV auth token |

For local testing with Vercel KV: `vercel env pull .env.local`

### Run locally

```bash
vercel dev
```

### Type check

```bash
npx tsc --noEmit
```

### Testing

```bash
# One-time scan via API
curl -X POST http://localhost:3000/api/scan-once \
  -H "Content-Type: application/json" \
  -d '{"githubUsername": "your-username", "email": "your@email.com"}'

# Simulate cron
curl -X POST http://localhost:3000/api/scan \
  -H "authorization: Bearer ${CRON_SECRET}"
```

### Deploy

```bash
vercel deploy --prod
```

Vercel cron runs automatically daily at 06:00 UTC after deployment.

## Dependencies and licenses

### Runtime dependencies

| Package | Version | License | Purpose |
|---------|---------|---------|---------|
| [next](https://github.com/vercel/next.js) | ^15.0.0 | MIT | Framework: landing page + API routes |
| [@vercel/kv](https://github.com/vercel/storage) | ^2.0.0 | Apache-2.0 | Subscriber storage (Redis) |
| [resend](https://github.com/resendlabs/resend-node) | ^4.0.0 | MIT | Email delivery for scan reports |
| [zod](https://github.com/colinhacks/zod) | ^3.23.0 | MIT | Schema validation for input and env vars |

### Dev dependencies

| Package | Version | License | Purpose |
|---------|---------|---------|---------|
| [typescript](https://github.com/microsoft/TypeScript) | ^5.5.0 | Apache-2.0 | TypeScript compiler |
| [@types/node](https://github.com/DefinitelyTyped/DefinitelyTyped) | ^22.0.0 | MIT | Node.js type definitions |
| [@types/react](https://github.com/DefinitelyTyped/DefinitelyTyped) | ^19.0.0 | MIT | React type definitions |

### External APIs and services

| Service | Purpose | Cost |
|---------|---------|------|
| [GitHub REST API](https://docs.github.com/en/rest) | Fetch repos and file content | Free (rate limited) |
| [OSV.dev API](https://osv.dev/) | Dependency vulnerability database | Free, open source (Apache-2.0) |
| [DeepSeek API](https://platform.deepseek.com/) | AI analysis of suspicious patterns | Paid, owner-scans only |
| [Resend](https://resend.com/) | Email delivery | Free tier available |
| [Vercel](https://vercel.com/) | Hosting, cron, KV (Redis) | Pro plan for 5 min function timeout |

### Inspiration sources (not direct dependencies)

Our scan patterns and strategies are based on best practices from:

| Tool | License | What we adopt |
|------|---------|---------------|
| [TruffleHog](https://github.com/trufflesecurity/trufflehog) | AGPL-3.0 | Verification strategy for discovered secrets |
| [Gitleaks](https://github.com/gitleaks/gitleaks) | MIT | SARIF-compatible finding structure |
| [detect-secrets](https://github.com/Yelp/detect-secrets) | Apache-2.0 | Entropy + regex combination approach |
| [OSV-Scanner](https://github.com/google/osv-scanner) | Apache-2.0 | Batch queries per ecosystem |
| [Presidio](https://github.com/microsoft/presidio) | MIT | Checksum validation (11-check, mod-97) |
| [Semgrep](https://github.com/semgrep/semgrep) | LGPL-2.1 | Context-aware scanning (skip test/mock files) |
| [Secrets Patterns DB](https://github.com/mazen160/secrets-patterns-db) | CC-BY-4.0 | Pattern database as reference |

### Related repository

| Repository | Purpose | License |
|------------|---------|---------|
| [rwrw01/golden-rulebook](https://github.com/rwrw01/golden-rulebook) | Coding standards, rules, and audit skills (source of `.claude/` config) | EUPL-1.2 |

## License

EUPL-1.2 — see [LICENSE](LICENSE)
