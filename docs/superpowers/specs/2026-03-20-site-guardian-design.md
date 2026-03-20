# Site Guardian — Design Specification

**Datum:** 2026-03-20
**Status:** Goedgekeurd
**Licentie:** EUPL-1.2

---

## 1. Doel

Site Guardian is een open source website-compliancescanner voor Nederlandse publieke instellingen (gemeenten, ziekenhuizen, waterschappen). Het scant websites op zes categorieën: cookies & tracking, security headers, digitale soevereiniteit, privacy & AVG, toegankelijkheid (basis) en technische hygiëne. Het resultaat is één overall score (A-F) met een gedetailleerd rapport in het Nederlands.

## 2. Gebruikersmodi

### 2.1 Self-service (MVP)

1. Gebruiker opent de webpagina
2. Vult een URL in (optioneel: emailadres voor rapport)
3. Kiest: snelle scan (één pagina) of diepe scan (crawl subpagina's, max ~20 pagina's)
4. Scan draait, resultaten verschijnen live in de browser
5. Indien email opgegeven: rapport ook per email, gebruiker wordt subscriber

### 2.2 Monitoring (fase 2)

1. Subscriber ontvangt periodiek (dagelijks/wekelijks) een scan per email
2. Rapport bevat vergelijking met vorige scan (verbetering/verslechtering)
3. Unsubscribe link in elke email

## 3. Scancategorieën

### 3.1 Cookies & Tracking (gewicht: 20%)

| Check | Methode | Betrouwbaarheid |
|-------|---------|-----------------|
| Cookies vóór consent | Playwright: pagina laden zonder interactie, cookies tellen | Hoog |
| Cookiebanner aanwezig | DOM-detectie van bekende CMP's + patronen | Hoog |
| Tracking scripts actief | Network requests loggen: GA, Meta Pixel, etc. | Hoog |

### 3.2 Security Headers (gewicht: 20%)

| Check | Methode | Betrouwbaarheid |
|-------|---------|-----------------|
| HTTPS + geldig certificaat | TLS-connectie opzetten | Zeer hoog |
| HSTS | HTTP response header | Zeer hoog |
| Content-Security-Policy | HTTP response header | Zeer hoog |
| X-Content-Type-Options | HTTP response header | Zeer hoog |
| X-Frame-Options | HTTP response header | Zeer hoog |
| Referrer-Policy | HTTP response header | Zeer hoog |
| Permissions-Policy | HTTP response header | Zeer hoog |
| DNSSEC | DNS lookup met DNSSEC validatie | Hoog |

### 3.3 Digitale Soevereiniteit (gewicht: 20%)

| Check | Methode | Betrouwbaarheid |
|-------|---------|-----------------|
| Third-party scripts van niet-EU partijen | Playwright: network requests loggen, domein → land mapping | Hoog |
| Externe fonts/CDN van niet-EU partijen | Network requests filteren op bekende US-CDN's | Hoog |
| DNS-provider herkomst | DNS lookup, provider identificatie | Hoog |
| Hosting/IP geolocation | IP → land via geolocation database | Hoog |
| Externe iframes/widgets van US-partijen | DOM-analyse op iframe src | Hoog |

**Bekende niet-EU partijen (niet uitputtend):** Google (Fonts, Analytics, Ads, reCAPTCHA, Tag Manager), Cloudflare, Amazon (CloudFront, AWS), Microsoft (Azure CDN, Clarity), Meta (Pixel), Akamai, Fastly, Unpkg, jsDelivr (US-gehost), jQuery CDN.

### 3.4 Privacy & AVG (gewicht: 15%)

| Check | Methode | Betrouwbaarheid |
|-------|---------|-----------------|
| Privacyverklaring vindbaar | Link-detectie: "privacy", "privacyverklaring", bekende URL-patronen | Redelijk (~80%) |
| Cookieverklaring aanwezig | Link-detectie: "cookies", "cookiebeleid" | Redelijk (~80%) |
| Formulieren via HTTPS | DOM-analyse: form action URLs | Hoog |
| Externe form-processors | DOM-analyse: form action naar externe domeinen | Hoog |

### 3.5 Toegankelijkheid basis (gewicht: 10%)

| Check | Methode | Betrouwbaarheid |
|-------|---------|-----------------|
| Toegankelijkheidsverklaring vindbaar | Link-detectie + check op toegankelijkheidsverklaring.nl | Redelijk (~85%) |
| lang-attribuut op html | DOM-analyse | Zeer hoog |
| alt-teksten op afbeeldingen | DOM-analyse | Hoog |
| Heading-hiërarchie (geen levels overgeslagen) | DOM-analyse | Hoog |
| Basis contrast-check | Computed styles analyse | Redelijk |

### 3.6 Technische Hygiëne (gewicht: 15%)

| Check | Methode | Betrouwbaarheid |
|-------|---------|-----------------|
| TLS 1.0/1.1 uitgeschakeld | TLS-connectie met specifieke protocol versies | Zeer hoog |
| Server-versie headers verborgen | HTTP response headers | Zeer hoog |
| Mixed content (HTTP op HTTPS) | Playwright: network requests loggen | Hoog |
| CMS-versie detectie (verouderd) | Meta-tags, bekende patronen, generator headers | Redelijk |
| Open directory listings | HTTP requests naar bekende paden | Hoog |

## 4. Scoring

### 4.1 Per check

- **Pass:** 100 punten
- **Partial:** 50 punten (gedeeltelijk in orde)
- **Fail:** 0 punten
- **Skipped:** niet meetellen in gemiddelde (voor low-confidence checks die niet konden worden uitgevoerd)

### 4.2 Per categorie

Ongewogen gemiddelde van alle uitgevoerde checks binnen de categorie.

### 4.3 Totaalscore

Gewogen gemiddelde van de 6 categorieën:

| Categorie | Gewicht |
|-----------|---------|
| Cookies & Tracking | 20% |
| Security Headers | 20% |
| Digitale Soevereiniteit | 20% |
| Privacy & AVG | 15% |
| Technische Hygiëne | 15% |
| Toegankelijkheid basis | 10% |

### 4.4 Lettercijfer

| Score | Cijfer | Betekenis |
|-------|--------|-----------|
| >= 90 | A | Uitstekend |
| >= 75 | B | Goed |
| >= 60 | C | Voldoende |
| >= 40 | D | Onvoldoende |
| < 40 | F | Kritiek |

E wordt overgeslagen, conform internationaal gebruik bij letter-grading.

### 4.5 Low-confidence checks

Checks met betrouwbaarheid "Redelijk" of lager die niet gevonden worden, rapporteren als "niet gevonden — handmatige controle aanbevolen" en tellen als `skipped` (niet als `fail`).

## 5. Rapport

### 5.1 Structuur

1. **Overall score** — prominent bovenaan (letter + kleur + percentage)
2. **Per categorie** — categoriescore + lijst bevindingen met severity
3. **Per bevinding** — wat er mis is, waarom het ertoe doet, hoe te fixen
4. **Handmatig te controleren** — low-confidence checks die niet konden worden geverifieerd
5. **Technische details** — welke checks uitgevoerd, welke overgeslagen (bot-detectie, timeout)

### 5.2 Taal

Nederlands. Technische termen (CSP, HSTS, TLS) mogen in het Engels.

### 5.3 Kanalen

- **Browser:** live resultaten tijdens scan, volledig rapport na afloop
- **Email:** HTML rapport via Resend (optioneel, indien emailadres opgegeven)

## 6. Scanstrategie

### 6.1 Twee lagen

| Laag | Methode | Bot-gevoelig | Checks |
|------|---------|-------------|--------|
| Netwerk | HTTP fetch, DNS, TLS handshake | Nee | Headers, TLS, DNSSEC, IP geolocation |
| Browser | Playwright headless Chromium | Mogelijk | Cookies, DOM, network requests, content |

### 6.2 Bot-identificatie

- User-Agent: `SiteGuardian/1.0 (compliancecheck; contact@publicvibes.nl)`
- Respectvol: max 1-2 requests/seconde per domein
- `robots.txt` respecteren (tenzij gebruiker expliciet anders kiest)

### 6.3 Geblokkeerd door WAF

- Rapporteer als bevinding: "Website gebruikt bot-protectie. Browserlaag kon niet worden uitgevoerd."
- Dit is zelf relevante informatie (soevereiniteitscheck als het Cloudflare is)
- Netwerklaag checks werken altijd
- Graceful degradation: rapporteer wat wél lukte

### 6.4 Diepe scan (optioneel)

- Crawl subpagina's vanaf de opgegeven URL via Playwright DOM-rendering (vangt ook JavaScript-gegenereerde links)
- Max ~20 pagina's, alleen binnen hetzelfde domein
- Deduplicatie op genormaliseerde URLs (strip fragment, sorteer query params)
- Combineer resultaten: als een check op één subpagina faalt, faalt de check

### 6.5 SSRF-bescherming

URL-input wordt gevalideerd met Zod:
- Alleen `https://` scheme toegestaan
- Blokkeer private IP-ranges: `10.x`, `172.16-31.x`, `192.168.x`, `127.x`, `::1`, `169.254.x`
- Blokkeer niet-routable en reserved domeinen (`localhost`, `.local`, `.internal`)
- DNS-resolutie check vóór scan: opgelost IP moet publiek zijn

### 6.6 Rate limiting

- Max 3 scans per IP per uur (snelle scan)
- Max 1 diepe scan per IP per uur
- Max 1 gelijktijdige Playwright-instantie (queue voor wachtende scans)
- HTTP 429 respons bij overschrijding met `Retry-After` header
- Rate limits opgeslagen in Redis (sliding window)

## 7. Technische Stack

| Component | Keuze | Reden |
|-----------|-------|-------|
| Framework | Next.js 16 (App Router) | Bekend van Git-Guardian, SSR + API routes |
| Browser engine | Playwright (Chromium) | Betrouwbaar, network interception, ARM64 support |
| Validatie | Zod | Standaard in je projecten |
| Email | Resend | Bekend van Git-Guardian |
| Opslag | Redis (Upstash of lokaal) | Subscribers, scan history, rate limiting |
| Taal | TypeScript strict, ESM only | Projectstandaard |
| Linter/formatter | Biome | Unified tool, TypeScript native |
| Testrunner | Vitest | ESM native, TypeScript zonder transpilatie |
| Licentie | EUPL-1.2 | Projectstandaard |

## 8. API-ontwerp

### 8.1 OpenAPI specificatie

API wordt eerst gedefinieerd in `api/specs/site-guardian.yaml` (OpenAPI 3.1). Types worden gegenereerd met `openapi-typescript`. Geen handmatige API-types.

### 8.2 Endpoints

Alle endpoints onder `/api/v1/` conform NL API Strategy. Responses bevatten HAL `_links` waar relevant (minimaal `self` per resource).

| Methode | Pad | Beschrijving |
|---------|-----|-------------|
| POST | `/api/v1/scan` | Start scan, return resultaten |
| POST | `/api/v1/subscribers` | Subscribe (email + URL) |
| DELETE | `/api/v1/subscribers/:id` | Unsubscribe |
| GET | `/api/v1/healthz` | Liveness: 200 als process draait |
| GET | `/api/v1/readyz` | Readiness: 200 als Redis bereikbaar |

### 8.3 Error responses

Alle fouten conform RFC 9457 `application/problem+json`:

```json
{
  "type": "https://siteguardian.publicvibes.nl/problems/rate-limited",
  "title": "Te veel verzoeken",
  "status": 429,
  "detail": "Maximaal 3 scans per uur. Probeer het over 12 minuten opnieuw.",
  "instance": "/api/v1/scan"
}
```

## 9. Projectstructuur

```
site-guardian/
├── api/
│   └── specs/
│       └── site-guardian.yaml          # OpenAPI 3.1 specificatie
├── app/
│   ├── page.tsx                        # Landing page: URL invoer + scan starten
│   ├── layout.tsx                      # Root layout
│   └── globals.css                     # Styling
├── src/
│   ├── ui/
│   │   ├── scan-form.tsx               # Scan invoerformulier
│   │   ├── score-display.tsx           # Overall score weergave (A-F)
│   │   ├── report-view.tsx             # Rapport weergave per categorie
│   │   └── index.ts                    # Barrel export
│   ├── process/
│   │   ├── scan-orchestrator.ts        # Scan workflow: netwerk → browser → score → rapport
│   │   └── index.ts                    # Barrel export
│   ├── integration/
│   │   ├── api/
│   │   │   ├── scan/route.ts           # POST /api/v1/scan
│   │   │   ├── subscribers/route.ts    # POST/DELETE /api/v1/subscribers
│   │   │   └── health/route.ts         # GET /api/v1/healthz, /api/v1/readyz
│   │   ├── resend-adapter.ts           # Resend email adapter
│   │   ├── types/                      # Generated types from OpenAPI spec
│   │   └── index.ts                    # Barrel export
│   ├── service/
│   │   ├── scanner/
│   │   │   ├── network.ts              # DNS, TLS, HTTP headers, IP geolocation
│   │   │   ├── browser.ts              # Playwright: cookies, DOM, requests
│   │   │   ├── cookies.ts              # Cookie-analyse + consent detectie
│   │   │   ├── headers.ts              # Security headers checks
│   │   │   ├── sovereignty.ts          # Third-party EU/non-EU classificatie
│   │   │   ├── privacy.ts              # Privacyverklaring, cookieverklaring detectie
│   │   │   ├── accessibility.ts        # Basis a11y checks (lang, alt, headings)
│   │   │   └── hygiene.ts              # TLS versie, server info, mixed content, CMS
│   │   ├── scoring.ts                  # Check results → scores → overall grade
│   │   ├── reporter.ts                 # HTML rapport generatie (Nederlands)
│   │   ├── domains.ts                  # URL validatie, SSRF-bescherming
│   │   └── index.ts                    # Barrel export
│   ├── data/
│   │   ├── redis.ts                    # Redis client + connection management
│   │   ├── subscribers.ts              # Subscriber CRUD (Redis)
│   │   ├── scan-store.ts              # Scan resultaat opslag (Redis)
│   │   ├── rate-limiter.ts            # Rate limiting (sliding window, Redis)
│   │   ├── sovereignty-domains.json    # Domein → land mapping database
│   │   ├── env.ts                      # Zod schema + validatie environment variables
│   │   └── index.ts                    # Barrel export
│   └── types.ts                        # Zod schemas, TypeScript types, Result<T>
├── docker-compose.dev.yml              # Lokale dev: Redis container
├── Dockerfile                          # Multi-stage build (fase 2)
├── .dockerignore                       # .git, node_modules, .env*, *.md, tests/
├── .env.example                        # Dummy environment variables
├── package.json
├── tsconfig.json
├── biome.json                          # Linter/formatter config
├── LICENSE                             # EUPL-1.2
└── README.md                           # Documentatie + dependency licentietabel
```

### 9.1 Afhankelijkheidsrichting

```
app/ (routing/layout) → src/ui/ (Interaction) → process/ → integration/ → service/ → data/
```

`app/` bevat alleen Next.js routing en layouts. `src/ui/` bevat herbruikbare UI-componenten (de Interaction-laag). Nooit opwaarts, nooit lagen overslaan. Elke laag exposeert alleen via `index.ts`.

## 10. Soevereiniteit-database

Mapping van bekende domeinen/CDN's naar land van herkomst. Data in `src/data/sovereignty-domains.json`, analyselogica in `src/service/scanner/sovereignty.ts`.

**Categorieën:**
- **US:** Google (*.google.com, *.googleapis.com, *.gstatic.com), Cloudflare (*.cloudflare.com, cdnjs.cloudflare.com), Amazon (*.cloudfront.net, *.amazonaws.com), Microsoft (*.msecnd.net, *.azure.com, *.clarity.ms), Meta (*.facebook.net, connect.facebook.net), Akamai, Fastly, Unpkg, jQuery CDN
- **EU:** Bunny.net (Slovenië), KeyCDN (Zwitserland), OVHcloud (Frankrijk), Hetzner (Duitsland), TransIP (Nederland), BIT (Nederland)
- **Onbekend:** IP geolocation als fallback

## 11. Teststrategie

### 11.1 Unit tests (Vitest)

- 80% line coverage op `src/service/` en `src/data/` lagen
- Scanner-modules testbaar via dependency injection: netwerk- en browsercalls als injecteerbare functies
- Testbestanden colocated: `{module}.test.ts`

### 11.2 Mock-strategie

- Playwright: mock via `page.route()` voor deterministische network responses
- DNS/TLS: injecteerbare resolver-functies, gemockt in tests
- Redis: in-memory mock (geen echte Redis nodig voor unit tests)
- Resend: mock adapter, verifieer email-inhoud zonder te verzenden

### 11.3 Integratietests

- Elk API endpoint: 1 happy path + 1 error path
- Rate limiting: verifieer 429 bij overschrijding
- Health endpoints: verifieer liveness/readiness

### 11.4 E2E tests (Playwright)

- MVP user journey: URL invoeren → scan starten → resultaat zien in browser
- Test tegen een lokale test-website met bekende bevindingen

## 12. Operationeel

### 12.1 Environment variables

```
# Verplicht
REDIS_URL=redis://localhost:6379        # Redis connectie
PORT=8080                               # Server port (default 8080, conform 12-factor)

# Optioneel
RESEND_API_KEY=re_xxx                   # Email delivery (optioneel in MVP)
SCAN_EMAIL_FROM=scan@publicvibes.nl     # Afzender email
```

Environment variables worden bij startup gevalideerd met een Zod schema in `src/data/env.ts`. Applicatie start niet als validatie faalt.

### 12.2 Graceful shutdown

```
SIGTERM ontvangen →
  1. Stop nieuwe scan-requests accepteren
  2. Wacht tot lopende Playwright-instantie klaar is (max 30s)
  3. Sluit Playwright browser
  4. Sluit Redis connectie
  5. Exit(0)
```

### 12.3 Logging

- JSON structured logging naar stdout
- Velden: timestamp, level, message, traceId, duration
- Geen PII of secrets in logs (URLs worden gelogd, email-adressen gemaskeerd)
- Log levels: error, warn, info, debug

### 12.4 Concurrency

- Max 1 gelijktijdige Playwright-instantie (Chromium is geheugenintensief)
- Wachtende scans in Redis queue (FIFO)
- Bij Docker deployment: memory limit 1GB (Node.js ~200MB + Chromium ~400MB + headroom)

## 13. Deployment

### 13.1 Fase 1: Lokaal

- `npm run dev` voor ontwikkeling
- `docker-compose -f docker-compose.dev.yml up` voor Redis
- Playwright lokaal geïnstalleerd

### 13.2 Fase 2: Docker op Hetzner VPS

- Multi-stage Dockerfile: Node 22 build → Node 22 slim + Playwright Chromium
- ARM64-compatible (Hetzner cax31)
- Docker Compose stack in `sovereign-stack/stacks/site-guardian/`
- Traefik routing: `siteguardian.publicvibes.nl`
- Dedicated netwerk: `net-fe-site-guardian`
- Memory limit: 1GB
- Hardening conform sovereign-stack standaarden:
  - Pinned image digest (SHA256)
  - `security_opt: no-new-privileges: true`
  - `cap_drop: ALL` + minimale `cap_add`
  - `read_only: true` + tmpfs
  - Healthcheck op `/api/v1/healthz`
  - JSON logging met rotatie (10M max, 3 bestanden)
  - `restart: on-failure:5`
  - PID limit

### 13.3 Toekomstige doelen

- NL Design System voor UI-componenten
- OpenTelemetry voor traces en metrics
- Haven-compliance en Helm chart voor Kubernetes-deployment bij overheidsinstellingen

## 14. Afbakening

### Wel in scope (MVP)

- Eenmalige scan via webpagina
- Alle 6 scancategorieën
- Overall score A-F
- Rapport in browser
- Email rapport (optioneel)
- Snelle scan (1 pagina) + diepe scan (max 20 pagina's)
- Rate limiting
- Health endpoints
- Unit + integratietests

### Niet in scope (MVP)

- Subscriber monitoring (periodieke scans) — fase 2
- Vergelijking met vorige scan — fase 2
- Admin portal — fase 2
- API voor externe integratie — fase 2
- Docker deployment — fase 2
- Historische data / trends — fase 2
- NL Design System styling — fase 2
- OpenTelemetry — fase 2

## 15. Open source

- Repository: publiek op GitHub
- Licentie: EUPL-1.2
- README met dependency-licentietabel
- .env.example met dummy waarden
- Geen secrets in code
