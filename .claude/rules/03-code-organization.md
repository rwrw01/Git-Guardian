# Code Organization (2025)

## Modern stack principles (2025+)

- **Runtime**: Current LTS version of your runtime (Node.js 22+, Bun, Deno). Pin major version.
- **Language**: TypeScript with `strict: true` MANDATORY. No `any`.
- **Modules**: ESM only (`import/export`). No CommonJS (`require`).
- **Bundler**: Must support ESM natively, tree-shaking, and fast HMR. No legacy bundlers.
- **Linter/formatter**: Use a single unified tool (not separate linter + formatter). Must support TypeScript natively.
- **Test runner**: Must support ESM natively and TypeScript without transpilation step.
- **Package manager**: Exact version pinning (`save-exact=true`). Lock file ALWAYS committed.
- **UI components**: Prefer copy-paste component libraries (no runtime overhead) over monolithic UI frameworks.
- **Schema validation**: Runtime type validation at all external boundaries (API input, env vars, file imports).

## File limits

- **Max 300 lines per file** (750 is the refactoring trigger, not the target).
- **Max 40 lines per function**. Longer -> extract helper.
- **Max cyclomatic complexity 10**. Use early returns, no nested if/else chains.
- **One export per file** for components/classes. Utils: max 5 related exports.

## Naming conventions

| What | Convention | Language | Example |
|------|-----------|----------|---------|
| Files/dirs | kebab-case | English | `user-profile.ts` |
| Variables/functions | camelCase | English | `getUserProfile()` |
| Classes/interfaces | PascalCase | English | `UserProfile` |
| Constants | UPPER_SNAKE | English | `MAX_RETRY_COUNT` |
| DB tables | snake_case | English | `user_profiles` |
| UI labels | — | Dutch | `"Gebruikersprofiel"` |
| User-facing errors | — | Dutch | `"Kon profiel niet laden"` |
| Log messages | — | English | `"Failed to load user profile"` |
| Code comments | — | English | `// Validate before processing` |
| Commits | — | English | `"Add user profile validation"` |

## Imports

- Named exports ONLY. No `export default` (causes inconsistent naming).
- Order (separated by blank line): 1) Node built-ins 2) External packages 3) `@/` absolute 4) Relative
- Path aliases: `@/` -> `src/`. Never `../../../` deeper than 2 levels.

## Error handling

- Never bare `try/catch` that swallows errors silently.
- Discriminated unions: `type Result<T> = { ok: true; data: T } | { ok: false; error: AppError }`
- HTTP errors: RFC 9457 `application/problem+json`.
- No `any`. Use `unknown` + type guards. No `@ts-ignore` without linked issue number.
- Zod schemas for ALL external input (API requests, CSV imports, env vars, URL params).
