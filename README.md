# Git Guardian

## Why this exists

Public GitHub repositories are visible to everyone — including bots that scrape for leaked API keys, database credentials, and personal data. A single committed secret can be exploited within minutes. Dependency vulnerabilities pile up silently. And personal information (BSN numbers, IBANs) sometimes ends up in code, config files, or test fixtures without anyone noticing.

Git Guardian watches your public repos so you don't have to. It runs a daily automated scan across every public repository for a GitHub user, looking for three categories of risk:

1. **Secrets and tokens** — AWS keys, GitHub tokens, private keys, API keys, passwords, and dozens more patterns. Uses regex matching combined with Shannon entropy analysis to catch both known patterns and high-entropy strings that look like credentials.

2. **Dependency vulnerabilities** — Parses lockfiles and manifests (`package.json`, `requirements.txt`, `Gemfile.lock`, `go.sum`, `pom.xml`) and queries the OSV.dev vulnerability database. Reports known CVEs with severity scores and fix versions.

3. **Personally identifiable information (PII)** — Dutch-specific detection for BSN numbers (validated with the 11-check algorithm), IBAN numbers (validated with mod-97 checksum), email addresses, phone numbers, KvK numbers, and postal codes. Not just regex — mathematical validation catches real numbers while reducing false positives.

When findings exist, a severity-classified report is emailed to the repository owner. No findings, no email — no noise.

## Owner vs. self-service mode

Git Guardian runs in two modes:

- **Daily cron (owner)** — Scans all subscribers automatically at 06:00 UTC. For the repo owner, scans include an optional DeepSeek AI analysis pass that reviews suspicious patterns, identifies likely false positives, and flags risks that regex alone would miss.

- **Self-service (anyone)** — A web page where anyone can enter their GitHub username and email to trigger a one-time scan of their public repos. The scan runs without DeepSeek (cost/privacy reasons). The user is added as a subscriber and receives future daily scans. Every email includes an unsubscribe link.

## What makes it different

Git Guardian is not a wrapper around existing tools. It is a purpose-built scanner that adopts the best ideas from the field — TruffleHog's verification approach, Gitleaks' SARIF structure, detect-secrets' entropy analysis, OSV-Scanner's batch querying, and Presidio's checksum validation — and combines them into a single lightweight service that runs on Vercel with zero infrastructure to manage.

## How it works

```
GitHub API          OSV.dev API         DeepSeek API (owner only)
    │                   │                       │
    ▼                   ▼                       ▼
┌─────────┐     ┌──────────────┐     ┌──────────────────┐
│ secrets  │     │ dependencies │     │  AI verification │
│ + PII   │     │    vulns     │     │  + deep analysis │
└────┬─────┘    └──────┬───────┘     └────────┬─────────┘
     │                 │                      │
     └────────┬────────┘──────────────────────┘
              ▼
       ┌────────────┐
       │  reporter   │  → severity classification
       └──────┬─────┘
              ▼
       ┌────────────┐
       │   resend    │  → HTML email report (Dutch)
       └────────────┘
```

Per repository: fetch the file tree via GitHub API (no clone needed), filter text files, run secret + PII scans in parallel, run dependency scan on manifest files, aggregate findings, optionally pass through DeepSeek, generate report, send email.

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
├── INSTALL.md               # Full installation and deployment guide
├── LICENSE                  # EUPL-1.2
└── README.md
```

## Getting started

See **[INSTALL.md](INSTALL.md)** for the full installation, configuration, and deployment guide.

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

Scan patterns and strategies are based on best practices from:

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
