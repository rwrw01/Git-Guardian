# CLAUDE.md — BlueDolphin Skills Catalog

## Project
Reusable audit and review skills catalog for M&I Partners projects.
Serves: iProva, Orbit, BlueDolphin, and future projects.
All skills prefixed `rwrw01-` for easy identification.

## Language
- Communication and reports: Dutch
- Code, configs, skill names/descriptions: English

## Reporting standard (all audit skills)
- **Severity levels**: CRITICAL > HIGH > MEDIUM > LOW
- **Per finding**: location (file:line), description, impact, fix, reference (CWE/OWASP)
- **Report structure**: Management summary -> Critical -> Medium -> Low -> Action list
- **Maturity scores**: 1 (absent) — 5 (best practice / exemplary)

## Skill conventions
- All skills: `disable-model-invocation: true` (manual trigger only)
- Names and descriptions in English (better matching)
- Report content in Dutch
- Use `$ARGUMENTS` for project-specific parameters
- Naming: `rwrw01-{function}` (kebab-case)

## Git & Licensing (Non-Negotiable)
- **License**: All repositories use EUPL-1.2. Include a `LICENSE` file in every new repo.
- **No AI co-author**: NEVER add `Co-Authored-By` lines for Claude, Anthropic, or any AI model in commit messages.
- **Dependency license table**: The README of every project MUST contain a table listing all used software/dependencies with their license. Update this table when dependencies change.

## No Loops Rule (applies to ALL agents and subagents)

Any repeated action that fails twice with the same or similar error MUST trigger a full stop:
1. Stop the current approach immediately.
2. State clearly: what was tried, what failed, what is known vs. unknown.
3. Ask the user for direction. Do NOT try a third variation of the same approach.

This applies to: debugging, implementation, tests, deployments, API calls, config changes — everything.

**Diagnosis**: if your analysis uses uncertain language ("perhaps", "maybe", "likely", "might be"), you get maximum 2 investigation attempts. After that: stop guessing, state facts vs. unknowns, ask the user.

**Security relaxations**: the 2-attempt limit applies to finding a solution WITHOUT the relaxation. Never implement a security relaxation as a "quick fix" without explicit user approval.
