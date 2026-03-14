# Golden Rulebook

Coding standards, architecture rules, and audit skills for Dutch government (Common Ground) projects.

## What's inside

### Rules (`~/.claude/rules/`)
Always-active coding standards — the **prevention layer**.

| Rule | Domain |
|------|--------|
| `01-architecture.md` | Common Ground 5-layer separation, API-first, NL API Strategy |
| `02-portability.md` | Docker, 12-factor app, Haven compliance, graceful shutdown |
| `03-code-organization.md` | TypeScript strict, ESM, file limits, naming, error handling |
| `04-security-coding.md` | Input validation, OIDC auth, secrets, output encoding, OpenTelemetry |
| `05-quality-gates.md` | Test coverage targets, code review checklist, performance baselines |

### Skills (`.claude/skills/`)
On-demand audit and review skills — the **detection layer**. All prefixed `rwrw01-`.

| Skill | Purpose |
|-------|---------|
| `rwrw01-security-audit` | OWASP Top 10 + defense-in-depth audit |
| `rwrw01-wcag-audit` | WCAG 2.2 AA accessibility audit |
| `rwrw01-ux-review` | UX review via Playwright + Nielsen heuristics |
| `rwrw01-common-ground-audit` | Common Ground 5-layer architecture compliance |
| `rwrw01-nen7510-audit` | NEN7510 healthcare security coverage analysis |
| `rwrw01-documentation` | Generate user & admin documentation (Dutch) |
| `rwrw01-refactoring` | Split large files into logical modules |

## Usage

### Install rules globally
```bash
cp .claude/rules/* ~/.claude/rules/
```

### Install skills into a project
```bash
cp -r .claude/skills/rwrw01-* your-project/.claude/skills/
```

## Design principles

- **Opinionated on principles, flexible on tools** — prescribe WHAT and WHY, not which specific tool
- **No ambiguity** — every rule has a concrete threshold or pattern
- **Testable** — every rule can be mechanically verified
- **Prevention + detection** — rules prevent violations, skills detect them

## License

EUPL-1.2 — see [LICENSE](LICENSE)
