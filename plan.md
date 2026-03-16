# Beveiligingsplan Git-Guardian — Volledige Uitwerking

## Overzicht

Dit plan adresseert alle gevonden beveiligingsproblemen in 4 fasen, van kritiek naar laag risico, plus het opzetten van een CI/CD pipeline met geautomatiseerde beveiligingsscans.

---

## Fase 1: CRITICAL fixes (directe code-changes)

### 1.1 Timing-safe vergelijkingen overal invoeren
- **Bestanden**: `src/subscribers.ts`, `app/api/scan/route.ts`, `app/api/subscribers/route.ts`
- **Actie**: Alle `===` vergelijkingen voor secrets/tokens vervangen door `timingSafeEqual()` uit `node:crypto`
- **Detail**: Helper-functie `safeCompare(a: string, b: string): boolean` maken in `src/crypto-utils.ts` en overal hergebruiken

### 1.2 Hardcoded fallback secret verwijderen
- **Bestand**: `src/subscribers.ts` (functie `getTokenSecret()`)
- **Actie**: `?? "fallback-secret"` verwijderen, `throw new Error()` als `CRON_SECRET` ontbreekt
- **Detail**: Startup-validatie toevoegen zodat app niet start zonder vereiste secrets

### 1.3 Aparte secret voor unsubscribe tokens
- **Bestand**: `src/subscribers.ts`, `.env.example`
- **Actie**: Nieuw env var `UNSUBSCRIBE_SECRET` introduceren, gescheiden van `CRON_SECRET`
- **Detail**: Fallback naar `CRON_SECRET` alleen tijdelijk voor backwards-compat, met deprecation warning

---

## Fase 2: HIGH fixes (input validatie & rate limiting)

### 2.1 Zod validatie op `/api/subscribers` POST
- **Bestand**: `app/api/subscribers/route.ts`
- **Actie**: Zod schema toevoegen: `z.object({ githubUsername: z.string().min(1).max(39).regex(/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/), email: z.string().email().max(254) })`

### 2.2 Zod validatie op `/api/contact` POST
- **Bestand**: `app/api/contact/route.ts`
- **Actie**: Zod schema met max lengtes: name (100), email (254), message (5000), organisation (200), githubOrg (39)

### 2.3 Zod validatie op `/api/admin/subscribers` POST
- **Bestand**: `app/api/admin/subscribers/route.ts`
- **Actie**: Zelfde schema als 2.1 hergebruiken

### 2.4 Rate limiting op login endpoint
- **Bestand**: `app/api/auth/login/route.ts`
- **Actie**: Redis-based rate limit: max 5 login pogingen per email per 15 minuten

### 2.5 Rate limiting op contact form
- **Bestand**: `app/api/contact/route.ts`
- **Actie**: Redis-based rate limit: max 3 berichten per IP per uur (via `x-forwarded-for` header)

---

## Fase 3: MEDIUM fixes (hardening)

### 3.1 HTTP security headers
- **Bestand**: `next.config.ts` (of nieuw `middleware.ts` update)
- **Actie**: Security headers toevoegen via Next.js config:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains`

### 3.2 Email masking in logs
- **Bestanden**: `app/api/auth/login/route.ts`, andere log-statements
- **Actie**: Email-adressen in logs hashen of maskeren (bijv. `j***@example.com`)

### 3.3 Generieke foutmeldingen voor publieke endpoints
- **Bestanden**: `app/api/scan-once/route.ts`, `app/api/auth/login/route.ts`
- **Actie**: Specifieke foutdetails alleen loggen, generieke melding naar client

---

## Fase 4: CI/CD Pipeline met beveiligingsscans

### 4.1 GitHub Actions workflow: `ci.yml`
- **Bestand**: `.github/workflows/ci.yml`
- **Triggers**: push naar `main`, alle pull requests
- **Jobs**:

```yaml
jobs:
  typecheck:
    # TypeScript strict checking
    - run: npm ci
    - run: npm run typecheck

  lint-and-format:
    # ESLint + Prettier (of Biome)
    - run: npx biome check src/

  dependency-audit:
    # npm audit voor bekende kwetsbaarheden
    - run: npm audit --audit-level=high

  secret-scan:
    # Gitleaks of TruffleHog voor gelekte secrets
    - uses: gitleaks/gitleaks-action@v2

  test:
    # Unit tests met coverage
    - run: npm test -- --coverage
    # Coverage check: min 80%

  build:
    # Verify dat de build slaagt
    - run: npm run build
```

### 4.2 GitHub Actions workflow: `security.yml`
- **Bestand**: `.github/workflows/security.yml`
- **Triggers**: wekelijks (schedule) + push naar main
- **Jobs**:
  - **CodeQL analysis** (SAST) voor JavaScript/TypeScript
  - **Dependency review** via `actions/dependency-review-action`
  - **OSSF Scorecard** voor supply chain security

### 4.3 Branch protection regels (documentatie)
- **Bestand**: `SECURITY.md`
- **Actie**: Documenteren welke branch protection rules ingesteld moeten worden:
  - Require PR reviews
  - Require status checks (typecheck, test, build, security)
  - No force push to main

---

## Samenvatting wijzigingen per bestand

| Bestand | Wijzigingen |
|---------|-------------|
| `src/crypto-utils.ts` | **NIEUW** — `safeCompare()` helper |
| `src/subscribers.ts` | Timing-safe compare, verwijder fallback secret, UNSUBSCRIBE_SECRET |
| `app/api/scan/route.ts` | Timing-safe CRON_SECRET check |
| `app/api/subscribers/route.ts` | Timing-safe check, Zod validatie |
| `app/api/contact/route.ts` | Zod validatie, rate limiting |
| `app/api/admin/subscribers/route.ts` | Zod validatie |
| `app/api/auth/login/route.ts` | Rate limiting, log masking |
| `app/api/scan-once/route.ts` | Generieke foutmeldingen |
| `next.config.ts` | Security headers |
| `.env.example` | UNSUBSCRIBE_SECRET toevoegen |
| `.github/workflows/ci.yml` | **NIEUW** — CI pipeline |
| `.github/workflows/security.yml` | **NIEUW** — Security scans |
| `src/types.ts` | Zod schemas voor contact & subscribers |

---

## Buiten scope (bewuste keuze)

- **Email verificatie voor subscribers**: Vereist UX-wijziging, apart ticket
- **Redis data encryptie**: Complexe migratie, apart ticket
- **CSRF tokens**: Next.js Server Actions bieden ingebouwde bescherming; huidige API routes zijn stateless
- **DeepSeek data anonymisatie**: Vereist product-beslissing over wat wel/niet verzonden mag worden
