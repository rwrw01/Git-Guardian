# Security Coding Patterns (2025)

Complements global CLAUDE.md (infra/config security). This file: application code.

## Input validation (every entry point)

- Zod schema BEFORE writing the handler. Schema IS the documentation.
- Server validates ALWAYS independently of client.
- Filenames: strip path separators, allow only alphanumeric + dash + dot.
- URLs: allowlist schemes (`https://` only), validate via `URL` constructor.
- Integers: explicit min/max in Zod (`z.number().int().min(1).max(10000)`).

## Authentication

- Keycloak/OIDC for all auth. No custom auth implementations.
- Session tokens: HttpOnly, Secure, SameSite=Strict cookies. NEVER localStorage.
- Token validation: signature, issuer, audience, expiry on EVERY request.
- Refresh tokens: one-time use, server-side storage, rotate on use.

## Authorization

- RBAC at the Process layer. Check permissions BEFORE business logic executes.
- Resource-level: verify requesting user owns/has access to the specific resource.
- Never use UI-hiding as access control. Server enforces ALL restrictions.
- Deny by default. Log every authorization failure (userId, resource, action, timestamp).

## Secrets

- Runtime via env vars or mounted files (`/run/secrets/`).
- Never log secrets. Mask in structured logs: `password: "***"`.
- `.env`: development ONLY. `.env.example` with dummy values committed.
- Design for zero-downtime rotation (dual-read during transition).

## Output encoding

- React/Next.js: JSX auto-escapes. NEVER `dangerouslySetInnerHTML` without DOMPurify.
- SQL: parameterized queries ONLY. Zero string concatenation.
- Shell: NEVER construct commands from user input. Use `execFile` with argument arrays.

## Observability (2025 standard)

- **OpenTelemetry** for traces, metrics, logs. No vendor-specific SDKs.
- Structured JSON logging to stdout. Correlation via trace-id.
- No sensitive data in traces/spans (PII, tokens, passwords).
