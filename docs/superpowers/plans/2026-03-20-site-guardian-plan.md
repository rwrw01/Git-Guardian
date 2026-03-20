# Site Guardian Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a website compliance scanner for Dutch public institutions that scans on cookies, security headers, digital sovereignty, privacy/GDPR, accessibility, and technical hygiene — producing an overall A-F grade.

**Architecture:** New Next.js 16 project with 5-layer architecture (ui/process/integration/service/data). Network-layer checks via HTTP/DNS, browser-layer checks via Playwright headless Chromium. Redis for rate limiting and scan storage. Local-first development, Docker deployment later.

**Tech Stack:** Next.js 16, TypeScript strict, Playwright, Zod, Vitest, Biome, Redis, Resend

**Spec:** `docs/superpowers/specs/2026-03-20-site-guardian-design.md`

---

## File Structure

```
C:/dev/guardian/site-guardian/
├── api/specs/site-guardian.yaml            # OpenAPI 3.1 spec
├── app/
│   ├── page.tsx                            # Landing page (imports src/ui components)
│   ├── layout.tsx                          # Root layout
│   ├── globals.css                         # Base styles
│   └── api/v1/
│       ├── scan/route.ts                   # POST scan endpoint
│       ├── subscribers/route.ts            # POST/DELETE subscribers
│       ├── healthz/route.ts                # GET liveness
│       └── readyz/route.ts                 # GET readiness (checks Redis)
├── src/
│   ├── types.ts                            # Shared Zod schemas, Result<T>, enums
│   ├── ui/
│   │   ├── scan-form.tsx                   # Scan input form
│   │   ├── score-display.tsx               # A-F score display
│   │   ├── report-view.tsx                 # Full report renderer
│   │   └── index.ts
│   ├── process/
│   │   ├── scan-orchestrator.ts            # Orchestrates full scan workflow
│   │   └── index.ts
│   ├── integration/
│   │   ├── resend-adapter.ts               # Email sending adapter
│   │   ├── types/                          # Generated from OpenAPI
│   │   └── index.ts
│   ├── service/
│   │   ├── scanner/
│   │   │   ├── network.ts                  # HTTP headers, TLS, DNS, IP geolocation
│   │   │   ├── browser.ts                  # Playwright page load + request logging
│   │   │   ├── cookies.ts                  # Cookie analysis + consent detection
│   │   │   ├── headers.ts                  # Security headers checks
│   │   │   ├── sovereignty.ts              # Third-party EU/non-EU classification
│   │   │   ├── privacy.ts                  # Privacy/cookie policy detection
│   │   │   ├── accessibility.ts            # Basic a11y checks
│   │   │   └── hygiene.ts                  # TLS version, server info, mixed content, CMS
│   │   ├── scoring.ts                      # Check results → weighted score → grade
│   │   ├── reporter.ts                     # HTML report generation (Dutch)
│   │   ├── domains.ts                      # URL validation + SSRF protection
│   │   └── index.ts
│   ├── data/
│   │   ├── env.ts                          # Zod env var validation
│   │   ├── redis.ts                        # Redis client + connection
│   │   ├── rate-limiter.ts                 # Sliding window rate limiting
│   │   ├── scan-store.ts                   # Scan result persistence
│   │   ├── subscribers.ts                  # Subscriber CRUD
│   │   ├── sovereignty-domains.json        # Domain → country mapping
│   │   └── index.ts
├── docker-compose.dev.yml                  # Local Redis
├── .env.example
├── package.json
├── tsconfig.json
├── biome.json
├── vitest.config.ts
├── LICENSE                                 # EUPL-1.2
└── README.md
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `C:/dev/guardian/site-guardian/package.json`
- Create: `C:/dev/guardian/site-guardian/tsconfig.json`
- Create: `C:/dev/guardian/site-guardian/biome.json`
- Create: `C:/dev/guardian/site-guardian/vitest.config.ts`
- Create: `C:/dev/guardian/site-guardian/.env.example`
- Create: `C:/dev/guardian/site-guardian/.gitignore`
- Create: `C:/dev/guardian/site-guardian/LICENSE`
- Create: `C:/dev/guardian/site-guardian/docker-compose.dev.yml`

- [ ] **Step 1: Create project directory and initialize git**

```bash
mkdir -p C:/dev/guardian/site-guardian
cd C:/dev/guardian/site-guardian
git init
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "site-guardian",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 8080",
    "build": "next build",
    "start": "next start -p 8080",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "next": "^16.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.24.0",
    "resend": "^4.0.0",
    "ioredis": "^5.4.0",
    "playwright": "^1.50.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@biomejs/biome": "^1.9.0",
    "vitest": "^3.0.0",
    "@vitest/coverage-v8": "^3.0.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", "next-env.d.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create biome.json**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "lineWidth": 100
  },
  "javascript": {
    "formatter": { "quoteStyle": "single" }
  }
}
```

- [ ] **Step 5: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/service/**', 'src/data/**'],
      thresholds: { lines: 80 },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

- [ ] **Step 6: Create .env.example**

```
# Required
REDIS_URL=redis://localhost:6379
PORT=8080

# Optional (email reports)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SCAN_EMAIL_FROM=scan@yourdomain.com
```

- [ ] **Step 7: Create .gitignore**

```
node_modules/
.next/
.env
.env.local
*.tsbuildinfo
coverage/
```

- [ ] **Step 8: Create docker-compose.dev.yml**

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

- [ ] **Step 9: Copy EUPL-1.2 LICENSE from Git-Guardian**

```bash
cp C:/dev/guardian/Git-Guardian/LICENSE C:/dev/guardian/site-guardian/LICENSE
```

- [ ] **Step 10: Install dependencies**

```bash
cd C:/dev/guardian/site-guardian
npm install
```

- [ ] **Step 11: Initialize Next.js app directory**

Create `app/layout.tsx`:
```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Site Guardian',
  description: 'Website compliance scanner voor Nederlandse publieke instellingen',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
```

Create `app/page.tsx` (placeholder):
```tsx
export default function Home() {
  return <main><h1>Site Guardian</h1><p>Coming soon</p></main>;
}
```

- [ ] **Step 12: Verify build and typecheck**

```bash
npm run typecheck
npm run build
```

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "Initialize Site Guardian project scaffold"
```

---

## Task 2: Shared Types & Environment Validation

**Files:**
- Create: `src/types.ts`
- Create: `src/data/env.ts`
- Create: `src/data/env.test.ts`
- Create: `src/data/index.ts`

- [ ] **Step 1: Write failing test for env validation**

`src/data/env.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateEnv } from './env';

describe('validateEnv', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('should return valid config when required vars are set', () => {
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    vi.stubEnv('PORT', '8080');
    const result = validateEnv();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.REDIS_URL).toBe('redis://localhost:6379');
      expect(result.data.PORT).toBe(8080);
    }
  });

  it('should use default PORT when not set', () => {
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    const result = validateEnv();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.PORT).toBe(8080);
    }
  });

  it('should fail when REDIS_URL is missing', () => {
    const result = validateEnv();
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/data/env.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Write src/types.ts**

```typescript
import { z } from 'zod';

// Result type — discriminated union for error handling
export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

export interface AppError {
  code: string;
  message: string;
  details?: unknown;
}

// Check result from a single scanner check
export const CheckStatus = {
  PASS: 'pass',
  PARTIAL: 'partial',
  FAIL: 'fail',
  SKIPPED: 'skipped',
} as const;

export type CheckStatus = (typeof CheckStatus)[keyof typeof CheckStatus];

export interface CheckResult {
  id: string;
  name: string;
  category: Category;
  status: CheckStatus;
  score: number; // 100, 50, 0
  description: string;
  impact: string;
  fix: string;
  confidence: 'zeer hoog' | 'hoog' | 'redelijk';
}

export const Category = {
  COOKIES: 'cookies',
  HEADERS: 'headers',
  SOVEREIGNTY: 'sovereignty',
  PRIVACY: 'privacy',
  ACCESSIBILITY: 'accessibility',
  HYGIENE: 'hygiene',
} as const;

export type Category = (typeof Category)[keyof typeof Category];

export const CATEGORY_WEIGHTS: Record<Category, number> = {
  cookies: 0.20,
  headers: 0.20,
  sovereignty: 0.20,
  privacy: 0.15,
  hygiene: 0.15,
  accessibility: 0.10,
};

export const Grade = {
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  F: 'F',
} as const;

export type Grade = (typeof Grade)[keyof typeof Grade];

export interface ScanReport {
  url: string;
  scannedAt: string;
  overallScore: number;
  grade: Grade;
  categories: CategoryResult[];
  checks: CheckResult[];
  skippedChecks: CheckResult[];
  errors: string[];
}

export interface CategoryResult {
  category: Category;
  label: string;
  score: number;
  weight: number;
  checksRun: number;
  checksPassed: number;
}

// Zod schemas for API input
export const ScanRequestSchema = z.object({
  url: z.string().url().startsWith('https://'),
  email: z.string().email().optional(),
  deep: z.boolean().default(false),
});

export type ScanRequest = z.infer<typeof ScanRequestSchema>;

export const SubscribeRequestSchema = z.object({
  email: z.string().email(),
  url: z.string().url().startsWith('https://'),
});

export type SubscribeRequest = z.infer<typeof SubscribeRequestSchema>;
```

- [ ] **Step 4: Write src/data/env.ts**

```typescript
import { z } from 'zod';

import type { Result } from '@/types';

const EnvSchema = z.object({
  REDIS_URL: z.string().url(),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  RESEND_API_KEY: z.string().optional(),
  SCAN_EMAIL_FROM: z.string().email().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(): Result<Env> {
  const parsed = EnvSchema.safeParse(process.env);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }
  return {
    ok: false,
    error: {
      code: 'ENV_VALIDATION_FAILED',
      message: `Invalid environment variables: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
      details: parsed.error.issues,
    },
  };
}
```

- [ ] **Step 5: Create src/data/index.ts barrel**

```typescript
export { validateEnv, type Env } from './env';
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run src/data/env.test.ts
```
Expected: 3 tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/data/
git commit -m "Add shared types, Result<T>, and env validation"
```

---

## Task 3: URL Validation & SSRF Protection

**Files:**
- Create: `src/service/domains.ts`
- Create: `src/service/domains.test.ts`
- Create: `src/service/index.ts`

- [ ] **Step 1: Write failing tests**

`src/service/domains.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { validateUrl } from './domains';

describe('validateUrl', () => {
  it('should accept valid https URL', () => {
    const result = validateUrl('https://gemeente.nl');
    expect(result.ok).toBe(true);
  });

  it('should reject http URL', () => {
    const result = validateUrl('http://gemeente.nl');
    expect(result.ok).toBe(false);
  });

  it('should reject localhost', () => {
    const result = validateUrl('https://localhost');
    expect(result.ok).toBe(false);
  });

  it('should reject private IP 192.168.x.x', () => {
    const result = validateUrl('https://192.168.1.1');
    expect(result.ok).toBe(false);
  });

  it('should reject private IP 10.x.x.x', () => {
    const result = validateUrl('https://10.0.0.1');
    expect(result.ok).toBe(false);
  });

  it('should reject private IP 172.16-31.x.x', () => {
    const result = validateUrl('https://172.16.0.1');
    expect(result.ok).toBe(false);
  });

  it('should reject 127.0.0.1', () => {
    const result = validateUrl('https://127.0.0.1');
    expect(result.ok).toBe(false);
  });

  it('should reject .local domains', () => {
    const result = validateUrl('https://server.local');
    expect(result.ok).toBe(false);
  });

  it('should reject .internal domains', () => {
    const result = validateUrl('https://app.internal');
    expect(result.ok).toBe(false);
  });

  it('should reject invalid URLs', () => {
    const result = validateUrl('not-a-url');
    expect(result.ok).toBe(false);
  });

  it('should normalize URL (strip trailing slash)', () => {
    const result = validateUrl('https://gemeente.nl/');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe('https://gemeente.nl');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/service/domains.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement domains.ts**

```typescript
import type { Result } from '@/types';

const BLOCKED_HOSTNAMES = ['localhost', '0.0.0.0', '[::1]'];
const BLOCKED_TLDS = ['.local', '.internal', '.localhost', '.test', '.example'];

const PRIVATE_IP_PATTERNS = [
  /^127\./,                          // loopback
  /^10\./,                           // class A private
  /^172\.(1[6-9]|2\d|3[01])\./,     // class B private
  /^192\.168\./,                     // class C private
  /^169\.254\./,                     // link-local
  /^0\./,                            // current network
  /^::1$/,                           // IPv6 loopback
  /^fe80:/i,                         // IPv6 link-local
  /^fc00:/i,                         // IPv6 unique local
  /^fd/i,                            // IPv6 unique local
];

export function validateUrl(input: string): Result<string> {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, error: { code: 'INVALID_URL', message: 'Ongeldige URL' } };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: { code: 'NOT_HTTPS', message: 'Alleen HTTPS URLs zijn toegestaan' } };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { ok: false, error: { code: 'BLOCKED_HOST', message: 'Dit domein is niet toegestaan' } };
  }

  for (const tld of BLOCKED_TLDS) {
    if (hostname.endsWith(tld)) {
      return { ok: false, error: { code: 'BLOCKED_TLD', message: 'Dit domein is niet toegestaan' } };
    }
  }

  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return { ok: false, error: { code: 'PRIVATE_IP', message: 'Privé IP-adressen zijn niet toegestaan' } };
    }
  }

  // Normalize: strip trailing slash, keep path
  let normalized = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return { ok: true, data: normalized };
}
```

- [ ] **Step 4: Create src/service/index.ts barrel**

```typescript
export { validateUrl } from './domains';
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/service/domains.test.ts
```
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/service/
git commit -m "Add URL validation with SSRF protection"
```

---

## Task 4: Security Headers Scanner

**Files:**
- Create: `src/service/scanner/headers.ts`
- Create: `src/service/scanner/headers.test.ts`

- [ ] **Step 1: Write failing tests**

`src/service/scanner/headers.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { checkSecurityHeaders } from './headers';
import type { CheckResult } from '@/types';

describe('checkSecurityHeaders', () => {
  const perfectHeaders: Record<string, string> = {
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'content-security-policy': "default-src 'self'",
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=()',
  };

  it('should pass all checks with perfect headers', () => {
    const results = checkSecurityHeaders(perfectHeaders, true);
    const failures = results.filter((r) => r.status === 'fail');
    expect(failures).toHaveLength(0);
  });

  it('should fail HSTS when header is missing', () => {
    const { 'strict-transport-security': _, ...noHsts } = perfectHeaders;
    const results = checkSecurityHeaders(noHsts, true);
    const hsts = results.find((r) => r.id === 'headers-hsts');
    expect(hsts?.status).toBe('fail');
  });

  it('should fail CSP when header is missing', () => {
    const { 'content-security-policy': _, ...noCsp } = perfectHeaders;
    const results = checkSecurityHeaders(noCsp, true);
    const csp = results.find((r) => r.id === 'headers-csp');
    expect(csp?.status).toBe('fail');
  });

  it('should fail HTTPS check when isHttps is false', () => {
    const results = checkSecurityHeaders(perfectHeaders, false);
    const https = results.find((r) => r.id === 'headers-https');
    expect(https?.status).toBe('fail');
  });

  it('should return partial for weak HSTS (low max-age)', () => {
    const weakHeaders = {
      ...perfectHeaders,
      'strict-transport-security': 'max-age=3600',
    };
    const results = checkSecurityHeaders(weakHeaders, true);
    const hsts = results.find((r) => r.id === 'headers-hsts');
    expect(hsts?.status).toBe('partial');
  });

  it('should return all 7 check results', () => {
    const results = checkSecurityHeaders(perfectHeaders, true);
    expect(results).toHaveLength(7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/service/scanner/headers.test.ts
```

- [ ] **Step 3: Implement headers.ts**

```typescript
import { type CheckResult, CheckStatus, Category } from '@/types';

const MIN_HSTS_MAX_AGE = 31536000; // 1 year
const WEAK_HSTS_THRESHOLD = 86400; // 1 day

export function checkSecurityHeaders(
  headers: Record<string, string>,
  isHttps: boolean,
): CheckResult[] {
  const get = (name: string) => headers[name.toLowerCase()] ?? headers[name] ?? null;

  return [
    checkHttps(isHttps),
    checkHsts(get('strict-transport-security')),
    checkCsp(get('content-security-policy')),
    checkXContentTypeOptions(get('x-content-type-options')),
    checkXFrameOptions(get('x-frame-options')),
    checkReferrerPolicy(get('referrer-policy')),
    checkPermissionsPolicy(get('permissions-policy')),
  ];
}

function checkHttps(isHttps: boolean): CheckResult {
  return {
    id: 'headers-https',
    name: 'HTTPS',
    category: Category.HEADERS,
    status: isHttps ? CheckStatus.PASS : CheckStatus.FAIL,
    score: isHttps ? 100 : 0,
    description: isHttps ? 'Website gebruikt HTTPS' : 'Website gebruikt geen HTTPS',
    impact: 'Zonder HTTPS is al het verkeer onversleuteld en manipuleerbaar',
    fix: 'Configureer een geldig TLS-certificaat en forceer HTTPS-redirects',
    confidence: 'zeer hoog',
  };
}

function checkHsts(value: string | null): CheckResult {
  if (!value) {
    return {
      id: 'headers-hsts',
      name: 'HSTS',
      category: Category.HEADERS,
      status: CheckStatus.FAIL,
      score: 0,
      description: 'Strict-Transport-Security header ontbreekt',
      impact: 'Bezoekers kunnen via onbeveiligd HTTP worden omgeleid (downgrade-aanval)',
      fix: 'Voeg header toe: Strict-Transport-Security: max-age=31536000; includeSubDomains',
      confidence: 'zeer hoog',
    };
  }

  const maxAgeMatch = value.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 0;

  if (maxAge >= MIN_HSTS_MAX_AGE) {
    return {
      id: 'headers-hsts',
      name: 'HSTS',
      category: Category.HEADERS,
      status: CheckStatus.PASS,
      score: 100,
      description: `HSTS actief met max-age=${maxAge}`,
      impact: '',
      fix: '',
      confidence: 'zeer hoog',
    };
  }

  return {
    id: 'headers-hsts',
    name: 'HSTS',
    category: Category.HEADERS,
    status: maxAge >= WEAK_HSTS_THRESHOLD ? CheckStatus.PARTIAL : CheckStatus.FAIL,
    score: maxAge >= WEAK_HSTS_THRESHOLD ? 50 : 0,
    description: `HSTS max-age te laag (${maxAge}s), aanbevolen: minimaal ${MIN_HSTS_MAX_AGE}s`,
    impact: 'Korte HSTS-periodes bieden beperkte bescherming tegen downgrade-aanvallen',
    fix: `Verhoog max-age naar minimaal ${MIN_HSTS_MAX_AGE} (1 jaar)`,
    confidence: 'zeer hoog',
  };
}

function checkCsp(value: string | null): CheckResult {
  return {
    id: 'headers-csp',
    name: 'Content-Security-Policy',
    category: Category.HEADERS,
    status: value ? CheckStatus.PASS : CheckStatus.FAIL,
    score: value ? 100 : 0,
    description: value
      ? 'Content-Security-Policy header aanwezig'
      : 'Content-Security-Policy header ontbreekt',
    impact: 'Zonder CSP is de website kwetsbaarder voor XSS-aanvallen',
    fix: "Voeg een Content-Security-Policy header toe, bijv: default-src 'self'",
    confidence: 'zeer hoog',
  };
}

function checkXContentTypeOptions(value: string | null): CheckResult {
  const isNosniff = value?.toLowerCase() === 'nosniff';
  return {
    id: 'headers-xcto',
    name: 'X-Content-Type-Options',
    category: Category.HEADERS,
    status: isNosniff ? CheckStatus.PASS : CheckStatus.FAIL,
    score: isNosniff ? 100 : 0,
    description: isNosniff
      ? 'X-Content-Type-Options: nosniff is ingesteld'
      : 'X-Content-Type-Options header ontbreekt of is onjuist',
    impact: 'Browsers kunnen bestanden als verkeerd type interpreteren (MIME sniffing)',
    fix: 'Voeg header toe: X-Content-Type-Options: nosniff',
    confidence: 'zeer hoog',
  };
}

function checkXFrameOptions(value: string | null): CheckResult {
  const valid = value && ['deny', 'sameorigin'].includes(value.toLowerCase());
  return {
    id: 'headers-xfo',
    name: 'X-Frame-Options',
    category: Category.HEADERS,
    status: valid ? CheckStatus.PASS : CheckStatus.FAIL,
    score: valid ? 100 : 0,
    description: valid
      ? `X-Frame-Options: ${value}`
      : 'X-Frame-Options header ontbreekt',
    impact: 'Website kan in een iframe worden geladen (clickjacking)',
    fix: 'Voeg header toe: X-Frame-Options: DENY',
    confidence: 'zeer hoog',
  };
}

function checkReferrerPolicy(value: string | null): CheckResult {
  const safe = [
    'no-referrer',
    'same-origin',
    'strict-origin',
    'strict-origin-when-cross-origin',
  ];
  const isSafe = value ? safe.includes(value.toLowerCase()) : false;
  return {
    id: 'headers-referrer',
    name: 'Referrer-Policy',
    category: Category.HEADERS,
    status: value ? (isSafe ? CheckStatus.PASS : CheckStatus.PARTIAL) : CheckStatus.FAIL,
    score: value ? (isSafe ? 100 : 50) : 0,
    description: value
      ? `Referrer-Policy: ${value}`
      : 'Referrer-Policy header ontbreekt',
    impact: 'Zonder Referrer-Policy kan gevoelige URL-informatie lekken naar externe sites',
    fix: 'Voeg header toe: Referrer-Policy: strict-origin-when-cross-origin',
    confidence: 'zeer hoog',
  };
}

function checkPermissionsPolicy(value: string | null): CheckResult {
  return {
    id: 'headers-permissions',
    name: 'Permissions-Policy',
    category: Category.HEADERS,
    status: value ? CheckStatus.PASS : CheckStatus.FAIL,
    score: value ? 100 : 0,
    description: value
      ? 'Permissions-Policy header aanwezig'
      : 'Permissions-Policy header ontbreekt',
    impact: 'Zonder Permissions-Policy kunnen ingesloten scripts camera, microfoon, etc. aanvragen',
    fix: 'Voeg header toe: Permissions-Policy: camera=(), microphone=(), geolocation=()',
    confidence: 'zeer hoog',
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/service/scanner/headers.test.ts
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/service/scanner/
git commit -m "Add security headers scanner with tests"
```

---

## Task 5: Sovereignty Domain Database & Scanner

**Files:**
- Create: `src/data/sovereignty-domains.json`
- Create: `src/service/scanner/sovereignty.ts`
- Create: `src/service/scanner/sovereignty.test.ts`

- [ ] **Step 1: Create sovereignty domain database**

`src/data/sovereignty-domains.json`:
```json
{
  "US": {
    "domains": [
      "*.google.com", "*.googleapis.com", "*.gstatic.com", "*.googletagmanager.com",
      "*.googlesyndication.com", "*.doubleclick.net", "*.google-analytics.com",
      "*.cloudflare.com", "cdnjs.cloudflare.com", "*.cloudflareinsights.com",
      "*.cloudfront.net", "*.amazonaws.com", "*.aws.amazon.com",
      "*.msecnd.net", "*.azure.com", "*.azureedge.net", "*.clarity.ms",
      "*.bing.com", "*.microsoft.com",
      "*.facebook.net", "connect.facebook.net", "*.fbcdn.net",
      "*.akamaized.net", "*.akamai.net",
      "*.fastly.net", "*.fastlylb.net",
      "unpkg.com", "cdn.jsdelivr.net",
      "code.jquery.com",
      "*.tiktok.com", "*.ttwstatic.com",
      "*.twitter.com", "*.twimg.com",
      "*.stripe.com", "js.stripe.com"
    ]
  },
  "EU": {
    "domains": [
      "*.bunny.net", "*.b-cdn.net",
      "*.keycdn.com",
      "*.ovh.net", "*.ovhcloud.com",
      "*.hetzner.com",
      "*.transip.nl", "*.transip.eu",
      "*.bit.nl",
      "*.sidn.nl",
      "*.surf.nl", "*.surfnet.nl",
      "*.eurid.eu"
    ]
  }
}
```

- [ ] **Step 2: Write failing tests**

`src/service/scanner/sovereignty.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { classifyDomain, checkSovereignty } from './sovereignty';

describe('classifyDomain', () => {
  it('should classify google fonts as US', () => {
    expect(classifyDomain('fonts.googleapis.com')).toBe('US');
  });

  it('should classify cloudflare as US', () => {
    expect(classifyDomain('cdnjs.cloudflare.com')).toBe('US');
  });

  it('should classify bunny.net as EU', () => {
    expect(classifyDomain('cdn.bunny.net')).toBe('EU');
  });

  it('should classify unknown domain as unknown', () => {
    expect(classifyDomain('example.com')).toBe('unknown');
  });

  it('should classify cloudfront as US', () => {
    expect(classifyDomain('d1234.cloudfront.net')).toBe('US');
  });
});

describe('checkSovereignty', () => {
  it('should pass when all requests are EU or first-party', () => {
    const results = checkSovereignty('gemeente.nl', [
      'https://gemeente.nl/style.css',
      'https://cdn.bunny.net/lib.js',
    ]);
    const thirdParty = results.find((r) => r.id === 'sovereignty-third-party');
    expect(thirdParty?.status).toBe('pass');
  });

  it('should fail when US third-party scripts detected', () => {
    const results = checkSovereignty('gemeente.nl', [
      'https://gemeente.nl/style.css',
      'https://www.googletagmanager.com/gtag/js',
      'https://fonts.googleapis.com/css2',
    ]);
    const thirdParty = results.find((r) => r.id === 'sovereignty-third-party');
    expect(thirdParty?.status).toBe('fail');
  });

  it('should return partial when mixed EU and US resources', () => {
    const results = checkSovereignty('gemeente.nl', [
      'https://gemeente.nl/main.js',
      'https://cdn.bunny.net/lib.js',
      'https://fonts.googleapis.com/css2',
    ]);
    const thirdParty = results.find((r) => r.id === 'sovereignty-third-party');
    expect(thirdParty?.status).toBe('fail');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run src/service/scanner/sovereignty.test.ts
```

- [ ] **Step 4: Implement sovereignty.ts**

```typescript
import { type CheckResult, CheckStatus, Category } from '@/types';
import domainDb from '@/data/sovereignty-domains.json';

type Region = 'US' | 'EU' | 'unknown';

function matchesPattern(hostname: string, pattern: string): boolean {
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1); // ".google.com"
    return hostname.endsWith(suffix) || hostname === pattern.slice(2);
  }
  return hostname === pattern;
}

export function classifyDomain(hostname: string): Region {
  const lower = hostname.toLowerCase();

  for (const domain of domainDb.US.domains) {
    if (matchesPattern(lower, domain)) return 'US';
  }
  for (const domain of domainDb.EU.domains) {
    if (matchesPattern(lower, domain)) return 'EU';
  }

  return 'unknown';
}

export function checkSovereignty(
  targetDomain: string,
  requestUrls: string[],
): CheckResult[] {
  const thirdPartyRequests = requestUrls
    .map((url) => { try { return new URL(url); } catch { return null; } })
    .filter((u): u is URL => u !== null)
    .filter((u) => {
      const host = u.hostname.toLowerCase();
      return !host.endsWith(targetDomain) && host !== targetDomain;
    });

  const classified = thirdPartyRequests.map((u) => ({
    url: u.hostname,
    region: classifyDomain(u.hostname),
  }));

  const usRequests = classified.filter((c) => c.region === 'US');
  const uniqueUsDomains = [...new Set(usRequests.map((r) => r.url))];

  let status: CheckStatus;
  let description: string;

  if (usRequests.length === 0) {
    status = CheckStatus.PASS;
    description = 'Geen third-party resources van niet-EU partijen gedetecteerd';
  } else {
    status = CheckStatus.FAIL;
    description = `${uniqueUsDomains.length} niet-EU third-party domein(en) gedetecteerd: ${uniqueUsDomains.join(', ')}`;
  }

  return [
    {
      id: 'sovereignty-third-party',
      name: 'Third-party resources (niet-EU)',
      category: Category.SOVEREIGNTY,
      status,
      score: status === 'pass' ? 100 : 0,
      description,
      impact: 'Data van bezoekers wordt gedeeld met niet-EU partijen, mogelijk in strijd met AVG/Schrems II',
      fix: 'Vervang niet-EU diensten door EU-alternatieven (bijv. Bunny.net, zelf-gehoste fonts)',
      confidence: 'hoog',
    },
  ];
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/service/scanner/sovereignty.test.ts
```
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/data/sovereignty-domains.json src/service/scanner/sovereignty.ts src/service/scanner/sovereignty.test.ts
git commit -m "Add sovereignty domain database and scanner"
```

---

## Task 6: Cookies & Tracking Scanner

**Files:**
- Create: `src/service/scanner/cookies.ts`
- Create: `src/service/scanner/cookies.test.ts`

- [ ] **Step 1: Write failing tests**

`src/service/scanner/cookies.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { checkCookies } from './cookies';

describe('checkCookies', () => {
  it('should pass when no cookies before consent', () => {
    const results = checkCookies([], [], false);
    const preConsent = results.find((r) => r.id === 'cookies-pre-consent');
    expect(preConsent?.status).toBe('pass');
  });

  it('should fail when cookies placed before consent', () => {
    const cookies = [{ name: '_ga', domain: '.example.com', value: 'GA1.2.xxx' }];
    const results = checkCookies(cookies, [], false);
    const preConsent = results.find((r) => r.id === 'cookies-pre-consent');
    expect(preConsent?.status).toBe('fail');
  });

  it('should detect tracking scripts', () => {
    const trackingUrls = [
      'https://www.googletagmanager.com/gtag/js?id=G-XXX',
      'https://connect.facebook.net/en_US/fbevents.js',
    ];
    const results = checkCookies([], trackingUrls, false);
    const tracking = results.find((r) => r.id === 'cookies-tracking');
    expect(tracking?.status).toBe('fail');
  });

  it('should pass when no tracking scripts', () => {
    const results = checkCookies([], ['https://gemeente.nl/main.js'], false);
    const tracking = results.find((r) => r.id === 'cookies-tracking');
    expect(tracking?.status).toBe('pass');
  });

  it('should detect cookie banner presence', () => {
    const results = checkCookies([], [], true);
    const banner = results.find((r) => r.id === 'cookies-banner');
    expect(banner?.status).toBe('pass');
  });

  it('should fail when no cookie banner detected', () => {
    const results = checkCookies([], [], false);
    const banner = results.find((r) => r.id === 'cookies-banner');
    expect(banner?.status).toBe('fail');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/service/scanner/cookies.test.ts
```

- [ ] **Step 3: Implement cookies.ts**

```typescript
import { type CheckResult, CheckStatus, Category } from '@/types';

interface CookieInfo {
  name: string;
  domain: string;
  value: string;
}

const TRACKING_PATTERNS = [
  /googletagmanager\.com/,
  /google-analytics\.com/,
  /analytics\.google\.com/,
  /connect\.facebook\.net/,
  /facebook\.net.*fbevents/,
  /clarity\.ms/,
  /hotjar\.com/,
  /plausible\.io/,
  /matomo\./,
  /piwik\./,
  /segment\.io/,
  /segment\.com\/analytics/,
  /tiktok\.com.*analytics/,
  /snap\.licdn\.com/,
  /ads\.linkedin\.com/,
];

export function checkCookies(
  cookiesBeforeConsent: CookieInfo[],
  requestUrls: string[],
  cookieBannerDetected: boolean,
): CheckResult[] {
  return [
    checkPreConsentCookies(cookiesBeforeConsent),
    checkTrackingScripts(requestUrls),
    checkCookieBanner(cookieBannerDetected),
  ];
}

function checkPreConsentCookies(cookies: CookieInfo[]): CheckResult {
  const hasCookies = cookies.length > 0;
  return {
    id: 'cookies-pre-consent',
    name: 'Cookies vóór consent',
    category: Category.COOKIES,
    status: hasCookies ? CheckStatus.FAIL : CheckStatus.PASS,
    score: hasCookies ? 0 : 100,
    description: hasCookies
      ? `${cookies.length} cookie(s) geplaatst vóór consent: ${cookies.map((c) => c.name).join(', ')}`
      : 'Geen cookies geplaatst vóór consent',
    impact: 'Cookies plaatsen zonder toestemming is in strijd met de AVG en ePrivacy-richtlijn',
    fix: 'Plaats geen cookies totdat de bezoeker expliciete toestemming heeft gegeven',
    confidence: 'hoog',
  };
}

function checkTrackingScripts(requestUrls: string[]): CheckResult {
  const trackers = requestUrls.filter((url) =>
    TRACKING_PATTERNS.some((pattern) => pattern.test(url)),
  );

  return {
    id: 'cookies-tracking',
    name: 'Tracking scripts',
    category: Category.COOKIES,
    status: trackers.length > 0 ? CheckStatus.FAIL : CheckStatus.PASS,
    score: trackers.length > 0 ? 0 : 100,
    description: trackers.length > 0
      ? `${trackers.length} tracking script(s) gedetecteerd`
      : 'Geen tracking scripts gedetecteerd',
    impact: 'Tracking scripts verzamelen bezoekersdata, vaak zonder afdoende toestemming',
    fix: 'Verwijder tracking scripts of laad ze pas na expliciete consent',
    confidence: 'hoog',
  };
}

function checkCookieBanner(detected: boolean): CheckResult {
  return {
    id: 'cookies-banner',
    name: 'Cookiebanner',
    category: Category.COOKIES,
    status: detected ? CheckStatus.PASS : CheckStatus.FAIL,
    score: detected ? 100 : 0,
    description: detected
      ? 'Cookiebanner gedetecteerd'
      : 'Geen cookiebanner gedetecteerd',
    impact: 'Zonder cookiebanner worden bezoekers niet geïnformeerd over cookiegebruik',
    fix: 'Implementeer een cookiebanner die voldoet aan de AVG/ePrivacy-richtlijn',
    confidence: 'hoog',
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/service/scanner/cookies.test.ts
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/service/scanner/cookies.ts src/service/scanner/cookies.test.ts
git commit -m "Add cookies and tracking scanner with tests"
```

---

## Task 7: Privacy & Accessibility Scanners

**Files:**
- Create: `src/service/scanner/privacy.ts`
- Create: `src/service/scanner/privacy.test.ts`
- Create: `src/service/scanner/accessibility.ts`
- Create: `src/service/scanner/accessibility.test.ts`

- [ ] **Step 1: Write failing tests for privacy scanner**

`src/service/scanner/privacy.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { checkPrivacy } from './privacy';

describe('checkPrivacy', () => {
  it('should detect privacy policy link', () => {
    const links = [{ href: '/privacyverklaring', text: 'Privacyverklaring' }];
    const results = checkPrivacy(links, []);
    const policy = results.find((r) => r.id === 'privacy-policy');
    expect(policy?.status).toBe('pass');
  });

  it('should skip privacy policy when not found (low confidence)', () => {
    const results = checkPrivacy([], []);
    const policy = results.find((r) => r.id === 'privacy-policy');
    expect(policy?.status).toBe('skipped');
  });

  it('should detect cookie policy link', () => {
    const links = [{ href: '/cookies', text: 'Cookiebeleid' }];
    const results = checkPrivacy(links, []);
    const cookie = results.find((r) => r.id === 'privacy-cookie-policy');
    expect(cookie?.status).toBe('pass');
  });

  it('should fail when forms post to external domain', () => {
    const forms = [{ action: 'https://docs.google.com/forms/submit', method: 'post' }];
    const results = checkPrivacy([], forms);
    const ext = results.find((r) => r.id === 'privacy-external-forms');
    expect(ext?.status).toBe('fail');
  });

  it('should pass when forms post to same domain', () => {
    const forms = [{ action: '/contact', method: 'post' }];
    const results = checkPrivacy([], forms);
    const ext = results.find((r) => r.id === 'privacy-external-forms');
    expect(ext?.status).toBe('pass');
  });
});
```

- [ ] **Step 2: Write failing tests for accessibility scanner**

`src/service/scanner/accessibility.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { checkAccessibility } from './accessibility';

interface A11yInput {
  htmlLang: string | null;
  images: { src: string; alt: string | null }[];
  headings: number[];
  a11yStatementFound: boolean;
}

describe('checkAccessibility', () => {
  const perfect: A11yInput = {
    htmlLang: 'nl',
    images: [{ src: '/img.jpg', alt: 'Beschrijving' }],
    headings: [1, 2, 3],
    a11yStatementFound: true,
  };

  it('should pass all checks with perfect input', () => {
    const results = checkAccessibility(perfect);
    const failures = results.filter((r) => r.status === 'fail');
    expect(failures).toHaveLength(0);
  });

  it('should fail when html lang is missing', () => {
    const results = checkAccessibility({ ...perfect, htmlLang: null });
    const lang = results.find((r) => r.id === 'a11y-lang');
    expect(lang?.status).toBe('fail');
  });

  it('should fail when image has no alt text', () => {
    const results = checkAccessibility({
      ...perfect,
      images: [{ src: '/img.jpg', alt: null }],
    });
    const alt = results.find((r) => r.id === 'a11y-alt');
    expect(alt?.status).toBe('fail');
  });

  it('should fail when heading hierarchy skips levels', () => {
    const results = checkAccessibility({ ...perfect, headings: [1, 3] });
    const headings = results.find((r) => r.id === 'a11y-headings');
    expect(headings?.status).toBe('fail');
  });

  it('should skip a11y statement when not found', () => {
    const results = checkAccessibility({ ...perfect, a11yStatementFound: false });
    const stmt = results.find((r) => r.id === 'a11y-statement');
    expect(stmt?.status).toBe('skipped');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run src/service/scanner/privacy.test.ts src/service/scanner/accessibility.test.ts
```

- [ ] **Step 4: Implement privacy.ts**

```typescript
import { type CheckResult, CheckStatus, Category } from '@/types';

interface LinkInfo { href: string; text: string; }
interface FormInfo { action: string; method: string; }

const PRIVACY_PATTERNS = [/privacy/i, /privacyverklaring/i, /privacybeleid/i, /gegevensbescherming/i];
const COOKIE_PATTERNS = [/cookie/i, /cookiebeleid/i, /cookieverklaring/i];
const EXTERNAL_FORM_HOSTS = ['docs.google.com', 'forms.google.com', 'typeform.com', 'jotform.com', 'surveymonkey.com'];

export function checkPrivacy(links: LinkInfo[], forms: FormInfo[]): CheckResult[] {
  return [
    checkPrivacyPolicy(links),
    checkCookiePolicy(links),
    checkExternalForms(forms),
  ];
}

function checkPrivacyPolicy(links: LinkInfo[]): CheckResult {
  const found = links.some(
    (l) => PRIVACY_PATTERNS.some((p) => p.test(l.href) || p.test(l.text)),
  );
  return {
    id: 'privacy-policy',
    name: 'Privacyverklaring',
    category: Category.PRIVACY,
    status: found ? CheckStatus.PASS : CheckStatus.SKIPPED,
    score: found ? 100 : 0,
    description: found
      ? 'Privacyverklaring gevonden'
      : 'Privacyverklaring niet gevonden — handmatige controle aanbevolen',
    impact: 'Publieke instellingen zijn wettelijk verplicht een privacyverklaring te publiceren',
    fix: 'Plaats een duidelijk vindbare link naar de privacyverklaring op elke pagina',
    confidence: 'redelijk',
  };
}

function checkCookiePolicy(links: LinkInfo[]): CheckResult {
  const found = links.some(
    (l) => COOKIE_PATTERNS.some((p) => p.test(l.href) || p.test(l.text)),
  );
  return {
    id: 'privacy-cookie-policy',
    name: 'Cookieverklaring',
    category: Category.PRIVACY,
    status: found ? CheckStatus.PASS : CheckStatus.SKIPPED,
    score: found ? 100 : 0,
    description: found
      ? 'Cookieverklaring gevonden'
      : 'Cookieverklaring niet gevonden — handmatige controle aanbevolen',
    impact: 'Bezoekers moeten geïnformeerd worden over welke cookies worden gebruikt en waarom',
    fix: 'Publiceer een cookieverklaring met overzicht van alle gebruikte cookies',
    confidence: 'redelijk',
  };
}

function checkExternalForms(forms: FormInfo[]): CheckResult {
  const external = forms.filter((f) => {
    try {
      const url = new URL(f.action, 'https://placeholder.local');
      return EXTERNAL_FORM_HOSTS.some((h) => url.hostname.includes(h));
    } catch {
      return false;
    }
  });

  return {
    id: 'privacy-external-forms',
    name: 'Externe form-processors',
    category: Category.PRIVACY,
    status: external.length > 0 ? CheckStatus.FAIL : CheckStatus.PASS,
    score: external.length > 0 ? 0 : 100,
    description: external.length > 0
      ? `${external.length} formulier(en) verzendt naar externe partij`
      : 'Geen formulieren naar externe partijen gedetecteerd',
    impact: 'Formulierdata wordt buiten de organisatie verwerkt, mogelijk zonder verwerkersovereenkomst',
    fix: 'Verwerk formulierdata op eigen servers of zorg voor een verwerkersovereenkomst',
    confidence: 'hoog',
  };
}
```

- [ ] **Step 5: Implement accessibility.ts**

```typescript
import { type CheckResult, CheckStatus, Category } from '@/types';

interface A11yInput {
  htmlLang: string | null;
  images: { src: string; alt: string | null }[];
  headings: number[];
  a11yStatementFound: boolean;
}

export function checkAccessibility(input: A11yInput): CheckResult[] {
  return [
    checkLang(input.htmlLang),
    checkAltTexts(input.images),
    checkHeadingHierarchy(input.headings),
    checkA11yStatement(input.a11yStatementFound),
  ];
}

function checkLang(lang: string | null): CheckResult {
  return {
    id: 'a11y-lang',
    name: 'HTML lang-attribuut',
    category: Category.ACCESSIBILITY,
    status: lang ? CheckStatus.PASS : CheckStatus.FAIL,
    score: lang ? 100 : 0,
    description: lang
      ? `HTML lang-attribuut ingesteld: "${lang}"`
      : 'HTML lang-attribuut ontbreekt',
    impact: 'Schermlezers weten niet in welke taal de pagina is, wat voorlezen onjuist maakt',
    fix: 'Voeg lang="nl" toe aan het <html> element',
    confidence: 'zeer hoog',
  };
}

function checkAltTexts(images: { src: string; alt: string | null }[]): CheckResult {
  if (images.length === 0) {
    return {
      id: 'a11y-alt',
      name: 'Alt-teksten',
      category: Category.ACCESSIBILITY,
      status: CheckStatus.PASS,
      score: 100,
      description: 'Geen afbeeldingen gevonden om te controleren',
      impact: '',
      fix: '',
      confidence: 'hoog',
    };
  }

  const missing = images.filter((img) => img.alt === null);
  const ratio = (images.length - missing.length) / images.length;

  return {
    id: 'a11y-alt',
    name: 'Alt-teksten',
    category: Category.ACCESSIBILITY,
    status: missing.length === 0 ? CheckStatus.PASS : ratio >= 0.5 ? CheckStatus.PARTIAL : CheckStatus.FAIL,
    score: missing.length === 0 ? 100 : ratio >= 0.5 ? 50 : 0,
    description: missing.length === 0
      ? `Alle ${images.length} afbeelding(en) hebben alt-tekst`
      : `${missing.length} van ${images.length} afbeelding(en) mist alt-tekst`,
    impact: 'Afbeeldingen zonder alt-tekst zijn onzichtbaar voor schermlezers',
    fix: 'Voeg beschrijvende alt-teksten toe aan alle afbeeldingen',
    confidence: 'hoog',
  };
}

function checkHeadingHierarchy(headings: number[]): CheckResult {
  if (headings.length === 0) {
    return {
      id: 'a11y-headings',
      name: 'Heading-hiërarchie',
      category: Category.ACCESSIBILITY,
      status: CheckStatus.PASS,
      score: 100,
      description: 'Geen headings gevonden',
      impact: '',
      fix: '',
      confidence: 'hoog',
    };
  }

  let skipped = false;
  for (let i = 1; i < headings.length; i++) {
    if (headings[i] > headings[i - 1] + 1) {
      skipped = true;
      break;
    }
  }

  return {
    id: 'a11y-headings',
    name: 'Heading-hiërarchie',
    category: Category.ACCESSIBILITY,
    status: skipped ? CheckStatus.FAIL : CheckStatus.PASS,
    score: skipped ? 0 : 100,
    description: skipped
      ? `Heading-niveaus worden overgeslagen (gevonden: ${headings.join(', ')})`
      : 'Heading-hiërarchie is correct',
    impact: 'Overgeslagen heading-niveaus maken navigatie met schermlezers verwarrend',
    fix: 'Gebruik headings in volgorde: h1 → h2 → h3, sla geen niveaus over',
    confidence: 'hoog',
  };
}

function checkA11yStatement(found: boolean): CheckResult {
  return {
    id: 'a11y-statement',
    name: 'Toegankelijkheidsverklaring',
    category: Category.ACCESSIBILITY,
    status: found ? CheckStatus.PASS : CheckStatus.SKIPPED,
    score: found ? 100 : 0,
    description: found
      ? 'Toegankelijkheidsverklaring gevonden'
      : 'Toegankelijkheidsverklaring niet gevonden — handmatige controle aanbevolen',
    impact: 'Overheidswebsites zijn wettelijk verplicht een toegankelijkheidsverklaring te publiceren',
    fix: 'Publiceer een toegankelijkheidsverklaring en registreer deze op toegankelijkheidsverklaring.nl',
    confidence: 'redelijk',
  };
}
```

- [ ] **Step 6: Run all tests**

```bash
npx vitest run src/service/scanner/privacy.test.ts src/service/scanner/accessibility.test.ts
```
Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add src/service/scanner/privacy.ts src/service/scanner/privacy.test.ts src/service/scanner/accessibility.ts src/service/scanner/accessibility.test.ts
git commit -m "Add privacy and accessibility scanners with tests"
```

---

## Task 8: Technical Hygiene Scanner

**Files:**
- Create: `src/service/scanner/hygiene.ts`
- Create: `src/service/scanner/hygiene.test.ts`

- [ ] **Step 1: Write failing tests**

`src/service/scanner/hygiene.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { checkHygiene } from './hygiene';

interface HygieneInput {
  serverHeader: string | null;
  xPoweredBy: string | null;
  mixedContentUrls: string[];
  generatorMeta: string | null;
}

describe('checkHygiene', () => {
  const clean: HygieneInput = {
    serverHeader: null,
    xPoweredBy: null,
    mixedContentUrls: [],
    generatorMeta: null,
  };

  it('should pass all checks with clean input', () => {
    const results = checkHygiene(clean);
    const failures = results.filter((r) => r.status === 'fail');
    expect(failures).toHaveLength(0);
  });

  it('should fail when server header exposes version', () => {
    const results = checkHygiene({ ...clean, serverHeader: 'Apache/2.4.51' });
    const server = results.find((r) => r.id === 'hygiene-server-header');
    expect(server?.status).toBe('fail');
  });

  it('should pass when server header is generic', () => {
    const results = checkHygiene({ ...clean, serverHeader: 'nginx' });
    const server = results.find((r) => r.id === 'hygiene-server-header');
    expect(server?.status).toBe('pass');
  });

  it('should fail when X-Powered-By is present', () => {
    const results = checkHygiene({ ...clean, xPoweredBy: 'Express' });
    const powered = results.find((r) => r.id === 'hygiene-powered-by');
    expect(powered?.status).toBe('fail');
  });

  it('should fail when mixed content detected', () => {
    const results = checkHygiene({
      ...clean,
      mixedContentUrls: ['http://example.com/script.js'],
    });
    const mixed = results.find((r) => r.id === 'hygiene-mixed-content');
    expect(mixed?.status).toBe('fail');
  });

  it('should detect outdated CMS version', () => {
    const results = checkHygiene({ ...clean, generatorMeta: 'WordPress 5.0' });
    const cms = results.find((r) => r.id === 'hygiene-cms');
    expect(cms?.status).toBe('partial');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/service/scanner/hygiene.test.ts
```

- [ ] **Step 3: Implement hygiene.ts**

```typescript
import { type CheckResult, CheckStatus, Category } from '@/types';

interface HygieneInput {
  serverHeader: string | null;
  xPoweredBy: string | null;
  mixedContentUrls: string[];
  generatorMeta: string | null;
}

const VERSION_PATTERN = /\d+\.\d+/;

export function checkHygiene(input: HygieneInput): CheckResult[] {
  return [
    checkServerHeader(input.serverHeader),
    checkPoweredBy(input.xPoweredBy),
    checkMixedContent(input.mixedContentUrls),
    checkCmsVersion(input.generatorMeta),
  ];
}

function checkServerHeader(value: string | null): CheckResult {
  const exposesVersion = value ? VERSION_PATTERN.test(value) : false;
  return {
    id: 'hygiene-server-header',
    name: 'Server-versie header',
    category: Category.HYGIENE,
    status: !value || !exposesVersion ? CheckStatus.PASS : CheckStatus.FAIL,
    score: !value || !exposesVersion ? 100 : 0,
    description: exposesVersion
      ? `Server header toont versie-informatie: "${value}"`
      : 'Server-versie is verborgen',
    impact: 'Versie-informatie helpt aanvallers bekende kwetsbaarheden te vinden',
    fix: 'Verberg de server-versie in de webserver configuratie (server_tokens off)',
    confidence: 'zeer hoog',
  };
}

function checkPoweredBy(value: string | null): CheckResult {
  return {
    id: 'hygiene-powered-by',
    name: 'X-Powered-By header',
    category: Category.HYGIENE,
    status: value ? CheckStatus.FAIL : CheckStatus.PASS,
    score: value ? 0 : 100,
    description: value
      ? `X-Powered-By header aanwezig: "${value}"`
      : 'X-Powered-By header niet aanwezig',
    impact: 'Toont welke technologie de server gebruikt, nuttig voor aanvallers',
    fix: 'Verwijder de X-Powered-By header uit de server configuratie',
    confidence: 'zeer hoog',
  };
}

function checkMixedContent(urls: string[]): CheckResult {
  return {
    id: 'hygiene-mixed-content',
    name: 'Mixed content',
    category: Category.HYGIENE,
    status: urls.length > 0 ? CheckStatus.FAIL : CheckStatus.PASS,
    score: urls.length > 0 ? 0 : 100,
    description: urls.length > 0
      ? `${urls.length} HTTP-resource(s) geladen op HTTPS-pagina`
      : 'Geen mixed content gedetecteerd',
    impact: 'HTTP-resources op een HTTPS-pagina ondermijnen de versleuteling',
    fix: 'Vervang alle http:// URLs door https://',
    confidence: 'hoog',
  };
}

function checkCmsVersion(generator: string | null): CheckResult {
  if (!generator) {
    return {
      id: 'hygiene-cms',
      name: 'CMS-versie',
      category: Category.HYGIENE,
      status: CheckStatus.PASS,
      score: 100,
      description: 'Geen CMS-versie gedetecteerd in meta-tags',
      impact: '',
      fix: '',
      confidence: 'redelijk',
    };
  }

  return {
    id: 'hygiene-cms',
    name: 'CMS-versie',
    category: Category.HYGIENE,
    status: CheckStatus.PARTIAL,
    score: 50,
    description: `CMS gedetecteerd: "${generator}" — controleer of dit de laatste versie is`,
    impact: 'Een verouderd CMS bevat mogelijk bekende beveiligingslekken',
    fix: 'Update het CMS naar de laatste versie en verberg de versie in de meta-tags',
    confidence: 'redelijk',
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/service/scanner/hygiene.test.ts
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/service/scanner/hygiene.ts src/service/scanner/hygiene.test.ts
git commit -m "Add technical hygiene scanner with tests"
```

---

## Task 9: Scoring Engine

**Files:**
- Create: `src/service/scoring.ts`
- Create: `src/service/scoring.test.ts`

- [ ] **Step 1: Write failing tests**

`src/service/scoring.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { calculateScore, getGrade } from './scoring';
import { Category, CheckStatus } from '@/types';
import type { CheckResult } from '@/types';

function makeCheck(category: Category, status: CheckStatus, score: number): CheckResult {
  return {
    id: `test-${category}-${Math.random()}`,
    name: 'Test check',
    category,
    status,
    score,
    description: '',
    impact: '',
    fix: '',
    confidence: 'hoog',
  };
}

describe('getGrade', () => {
  it('should return A for score >= 90', () => expect(getGrade(95)).toBe('A'));
  it('should return B for score >= 75', () => expect(getGrade(80)).toBe('B'));
  it('should return C for score >= 60', () => expect(getGrade(65)).toBe('C'));
  it('should return D for score >= 40', () => expect(getGrade(45)).toBe('D'));
  it('should return F for score < 40', () => expect(getGrade(20)).toBe('F'));
});

describe('calculateScore', () => {
  it('should return 100 when all checks pass', () => {
    const checks = Object.values(Category).map((cat) => makeCheck(cat, CheckStatus.PASS, 100));
    const result = calculateScore(checks);
    expect(result.overallScore).toBe(100);
    expect(result.grade).toBe('A');
  });

  it('should return 0 when all checks fail', () => {
    const checks = Object.values(Category).map((cat) => makeCheck(cat, CheckStatus.FAIL, 0));
    const result = calculateScore(checks);
    expect(result.overallScore).toBe(0);
    expect(result.grade).toBe('F');
  });

  it('should exclude skipped checks from average', () => {
    const checks = [
      makeCheck(Category.HEADERS, CheckStatus.PASS, 100),
      makeCheck(Category.HEADERS, CheckStatus.SKIPPED, 0),
    ];
    const result = calculateScore(checks);
    const headersCategory = result.categories.find((c) => c.category === Category.HEADERS);
    expect(headersCategory?.score).toBe(100);
  });

  it('should apply category weights correctly', () => {
    // All pass except sovereignty (weight 20%) which fails
    const checks = [
      makeCheck(Category.COOKIES, CheckStatus.PASS, 100),
      makeCheck(Category.HEADERS, CheckStatus.PASS, 100),
      makeCheck(Category.SOVEREIGNTY, CheckStatus.FAIL, 0),
      makeCheck(Category.PRIVACY, CheckStatus.PASS, 100),
      makeCheck(Category.ACCESSIBILITY, CheckStatus.PASS, 100),
      makeCheck(Category.HYGIENE, CheckStatus.PASS, 100),
    ];
    const result = calculateScore(checks);
    expect(result.overallScore).toBe(80); // 100 - 20% weight
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/service/scoring.test.ts
```

- [ ] **Step 3: Implement scoring.ts**

```typescript
import {
  type CheckResult,
  type CategoryResult,
  type Grade,
  Category,
  CheckStatus,
  CATEGORY_WEIGHTS,
  Grade as GradeValues,
} from '@/types';

interface ScoreResult {
  overallScore: number;
  grade: Grade;
  categories: CategoryResult[];
}

const CATEGORY_LABELS: Record<Category, string> = {
  cookies: 'Cookies & Tracking',
  headers: 'Security Headers',
  sovereignty: 'Digitale Soevereiniteit',
  privacy: 'Privacy & AVG',
  accessibility: 'Toegankelijkheid',
  hygiene: 'Technische Hygiëne',
};

export function getGrade(score: number): Grade {
  if (score >= 90) return GradeValues.A;
  if (score >= 75) return GradeValues.B;
  if (score >= 60) return GradeValues.C;
  if (score >= 40) return GradeValues.D;
  return GradeValues.F;
}

export function calculateScore(checks: CheckResult[]): ScoreResult {
  const categories: CategoryResult[] = Object.values(Category).map((cat) => {
    const catChecks = checks.filter((c) => c.category === cat);
    const scoredChecks = catChecks.filter((c) => c.status !== CheckStatus.SKIPPED);

    const score = scoredChecks.length > 0
      ? Math.round(scoredChecks.reduce((sum, c) => sum + c.score, 0) / scoredChecks.length)
      : 0;

    return {
      category: cat,
      label: CATEGORY_LABELS[cat],
      score,
      weight: CATEGORY_WEIGHTS[cat],
      checksRun: scoredChecks.length,
      checksPassed: scoredChecks.filter((c) => c.status === CheckStatus.PASS).length,
    };
  });

  const overallScore = Math.round(
    categories.reduce((sum, cat) => sum + cat.score * cat.weight, 0),
  );

  return {
    overallScore,
    grade: getGrade(overallScore),
    categories,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/service/scoring.test.ts
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/service/scoring.ts src/service/scoring.test.ts
git commit -m "Add scoring engine with weighted category grades"
```

---

## Task 10: Network Layer Scanner

**Files:**
- Create: `src/service/scanner/network.ts`
- Create: `src/service/scanner/network.test.ts`

- [ ] **Step 1: Write failing tests**

`src/service/scanner/network.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchNetworkData } from './network';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('fetchNetworkData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return network data on success', async () => {
    const headers = new Headers({
      'strict-transport-security': 'max-age=31536000',
      'server': 'nginx',
    });
    mockFetch.mockResolvedValue({ status: 200, headers });

    const result = await fetchNetworkData('https://example.com');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.statusCode).toBe(200);
      expect(result.data.isHttps).toBe(true);
      expect(result.data.headers['server']).toBe('nginx');
    }
  });

  it('should return error on network failure', async () => {
    mockFetch.mockRejectedValue(new Error('ENOTFOUND'));

    const result = await fetchNetworkData('https://nonexistent.example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NETWORK_ERROR');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/service/scanner/network.test.ts
```

- [ ] **Step 3: Implement network.ts**

```typescript
import type { Result } from '@/types';

export interface NetworkData {
  statusCode: number;
  headers: Record<string, string>;
  isHttps: boolean;
  serverHeader: string | null;
  xPoweredBy: string | null;
  ipAddress: string | null;
  responseTimeMs: number;
}

const USER_AGENT = 'SiteGuardian/1.0 (compliancecheck; contact@publicvibes.nl)';

export async function fetchNetworkData(url: string): Promise<Result<NetworkData>> {
  const start = Date.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });

    const responseTimeMs = Date.now() - start;
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    return {
      ok: true,
      data: {
        statusCode: response.status,
        headers,
        isHttps: url.startsWith('https://'),
        serverHeader: headers['server'] ?? null,
        xPoweredBy: headers['x-powered-by'] ?? null,
        ipAddress: null, // Resolved at DNS level, not available from fetch
        responseTimeMs,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'NETWORK_ERROR',
        message: `Kan ${url} niet bereiken: ${error instanceof Error ? error.message : 'onbekende fout'}`,
      },
    };
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/service/scanner/network.test.ts
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/service/scanner/network.ts src/service/scanner/network.test.ts
git commit -m "Add network layer scanner for HTTP headers and TLS"
```

---

## Task 11: Browser Layer Scanner (Playwright)

**Files:**
- Create: `src/service/scanner/browser.ts`
- Create: `src/service/scanner/browser.test.ts`

- [ ] **Step 1: Write failing tests**

`src/service/scanner/browser.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { scanWithBrowser } from './browser';

describe('scanWithBrowser', () => {
  it('should load a page and return browser data', async () => {
    const result = await scanWithBrowser('https://example.com');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.cookies).toBeDefined();
      expect(result.data.requestUrls).toBeDefined();
      expect(result.data.htmlLang).toBeDefined();
      expect(Array.isArray(result.data.images)).toBe(true);
      expect(Array.isArray(result.data.headings)).toBe(true);
      expect(Array.isArray(result.data.links)).toBe(true);
    }
  }, 30000);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/service/scanner/browser.test.ts
```

- [ ] **Step 3: Implement browser.ts**

```typescript
import { chromium, type Browser, type Page } from 'playwright';
import type { Result } from '@/types';

export interface BrowserData {
  cookies: { name: string; domain: string; value: string }[];
  requestUrls: string[];
  htmlLang: string | null;
  images: { src: string; alt: string | null }[];
  headings: number[];
  links: { href: string; text: string }[];
  forms: { action: string; method: string }[];
  cookieBannerDetected: boolean;
  generatorMeta: string | null;
  mixedContentUrls: string[];
  a11yStatementFound: boolean;
}

const USER_AGENT = 'SiteGuardian/1.0 (compliancecheck; contact@publicvibes.nl)';

const COOKIE_BANNER_SELECTORS = [
  '[class*="cookie"]', '[id*="cookie"]',
  '[class*="consent"]', '[id*="consent"]',
  '[class*="gdpr"]', '[id*="gdpr"]',
  '[class*="privacy-banner"]',
  '.cc-window', '#CybotCookiebotDialog',
  '#onetrust-banner-sdk', '.optanon-alert-box-wrapper',
];

const A11Y_STATEMENT_PATTERNS = [
  /toegankelijkheid/i, /accessibility/i,
  /toegankelijkheidsverklaring/i,
];

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({ headless: true });
  }
  return browserInstance;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance?.isConnected()) {
    await browserInstance.close();
    browserInstance = null;
  }
}

export async function scanWithBrowser(url: string): Promise<Result<BrowserData>> {
  let page: Page | null = null;

  try {
    const browser = await getBrowser();
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      locale: 'nl-NL',
      viewport: { width: 1280, height: 720 },
    });

    page = await context.newPage();

    const requestUrls: string[] = [];
    const mixedContentUrls: string[] = [];

    page.on('request', (req) => {
      requestUrls.push(req.url());
      if (url.startsWith('https://') && req.url().startsWith('http://')) {
        mixedContentUrls.push(req.url());
      }
    });

    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });

    const cookies = (await context.cookies()).map((c) => ({
      name: c.name,
      domain: c.domain,
      value: c.value,
    }));

    const htmlLang = await page.getAttribute('html', 'lang');

    const images = await page.$$eval('img', (imgs) =>
      imgs.map((img) => ({
        src: img.getAttribute('src') ?? '',
        alt: img.getAttribute('alt'),
      })),
    );

    const headings = await page.$$eval('h1,h2,h3,h4,h5,h6', (els) =>
      els.map((el) => parseInt(el.tagName.substring(1), 10)),
    );

    const links = await page.$$eval('a[href]', (anchors) =>
      anchors.map((a) => ({
        href: a.getAttribute('href') ?? '',
        text: a.textContent?.trim() ?? '',
      })),
    );

    const forms = await page.$$eval('form', (formEls) =>
      formEls.map((f) => ({
        action: f.getAttribute('action') ?? '',
        method: (f.getAttribute('method') ?? 'get').toLowerCase(),
      })),
    );

    const cookieBannerDetected = await page.evaluate((selectors) => {
      return selectors.some((sel) => document.querySelector(sel) !== null);
    }, COOKIE_BANNER_SELECTORS);

    const generatorMeta = await page.$eval(
      'meta[name="generator"]',
      (el) => el.getAttribute('content'),
    ).catch(() => null);

    const a11yStatementFound = links.some(
      (l) => A11Y_STATEMENT_PATTERNS.some((p) => p.test(l.href) || p.test(l.text)),
    );

    await context.close();

    return {
      ok: true,
      data: {
        cookies,
        requestUrls,
        htmlLang,
        images,
        headings,
        links,
        forms,
        cookieBannerDetected,
        generatorMeta,
        mixedContentUrls,
        a11yStatementFound,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'BROWSER_ERROR',
        message: `Browser scan mislukt: ${error instanceof Error ? error.message : 'onbekende fout'}`,
      },
    };
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/service/scanner/browser.test.ts
```
Expected: PASS (requires Playwright browsers installed: `npx playwright install chromium`)

- [ ] **Step 5: Commit**

```bash
git add src/service/scanner/browser.ts src/service/scanner/browser.test.ts
git commit -m "Add Playwright browser layer scanner"
```

---

## Task 12: Scan Orchestrator

**Files:**
- Create: `src/process/scan-orchestrator.ts`
- Create: `src/process/scan-orchestrator.test.ts`
- Create: `src/process/index.ts`

- [ ] **Step 1: Write failing tests**

`src/process/scan-orchestrator.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { orchestrateScan } from './scan-orchestrator';

// Mock the scanner modules
vi.mock('@/service/scanner/network', () => ({
  fetchNetworkData: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      statusCode: 200,
      headers: {
        'strict-transport-security': 'max-age=31536000',
        'content-security-policy': "default-src 'self'",
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'permissions-policy': 'camera=()',
      },
      isHttps: true,
      serverHeader: null,
      xPoweredBy: null,
      ipAddress: null,
      responseTimeMs: 200,
    },
  }),
}));

vi.mock('@/service/scanner/browser', () => ({
  scanWithBrowser: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      cookies: [],
      requestUrls: ['https://gemeente.nl/style.css'],
      htmlLang: 'nl',
      images: [{ src: '/logo.png', alt: 'Logo' }],
      headings: [1, 2, 3],
      links: [{ href: '/privacy', text: 'Privacyverklaring' }],
      forms: [],
      cookieBannerDetected: true,
      generatorMeta: null,
      mixedContentUrls: [],
      a11yStatementFound: true,
    },
  }),
}));

describe('orchestrateScan', () => {
  it('should return a complete scan report', async () => {
    const result = await orchestrateScan('https://gemeente.nl');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.url).toBe('https://gemeente.nl');
      expect(result.data.grade).toBeDefined();
      expect(result.data.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.data.overallScore).toBeLessThanOrEqual(100);
      expect(result.data.categories).toHaveLength(6);
      expect(result.data.checks.length).toBeGreaterThan(0);
    }
  });

  it('should still produce a report when browser layer fails', async () => {
    const { scanWithBrowser } = await import('@/service/scanner/browser');
    vi.mocked(scanWithBrowser).mockResolvedValueOnce({
      ok: false,
      error: { code: 'BROWSER_ERROR', message: 'Blocked by WAF' },
    });

    const result = await orchestrateScan('https://gemeente.nl');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.errors.length).toBeGreaterThan(0);
      // Network-layer checks should still produce results
      expect(result.data.checks.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/process/scan-orchestrator.test.ts
```

- [ ] **Step 3: Implement scan-orchestrator.ts**

```typescript
import type { Result, ScanReport, CheckResult } from '@/types';
import { fetchNetworkData } from '@/service/scanner/network';
import { scanWithBrowser } from '@/service/scanner/browser';
import { checkSecurityHeaders } from '@/service/scanner/headers';
import { checkCookies } from '@/service/scanner/cookies';
import { checkSovereignty } from '@/service/scanner/sovereignty';
import { checkPrivacy } from '@/service/scanner/privacy';
import { checkAccessibility } from '@/service/scanner/accessibility';
import { checkHygiene } from '@/service/scanner/hygiene';
import { calculateScore } from '@/service/scoring';

export async function orchestrateScan(url: string): Promise<Result<ScanReport>> {
  const errors: string[] = [];
  const allChecks: CheckResult[] = [];

  // Layer 1: Network (always works)
  const networkResult = await fetchNetworkData(url);
  if (networkResult.ok) {
    const { headers, isHttps, serverHeader, xPoweredBy } = networkResult.data;
    allChecks.push(...checkSecurityHeaders(headers, isHttps));
    allChecks.push(...checkHygiene({
      serverHeader,
      xPoweredBy,
      mixedContentUrls: [],
      generatorMeta: null,
    }));
  } else {
    errors.push(`Netwerklaag: ${networkResult.error.message}`);
  }

  // Layer 2: Browser (may be blocked)
  const domain = new URL(url).hostname;
  const browserResult = await scanWithBrowser(url);

  if (browserResult.ok) {
    const data = browserResult.data;

    allChecks.push(...checkCookies(data.cookies, data.requestUrls, data.cookieBannerDetected));
    allChecks.push(...checkSovereignty(domain, data.requestUrls));
    allChecks.push(...checkPrivacy(data.links, data.forms));
    allChecks.push(...checkAccessibility({
      htmlLang: data.htmlLang,
      images: data.images,
      headings: data.headings,
      a11yStatementFound: data.a11yStatementFound,
    }));

    // Enrich hygiene with browser data
    if (networkResult.ok) {
      const hygieneChecks = allChecks.filter((c) => c.category === 'hygiene');
      // Replace mixed content check if we have browser data
      const existingMixed = hygieneChecks.find((c) => c.id === 'hygiene-mixed-content');
      if (existingMixed && data.mixedContentUrls.length > 0) {
        existingMixed.status = 'fail';
        existingMixed.score = 0;
        existingMixed.description = `${data.mixedContentUrls.length} HTTP-resource(s) geladen op HTTPS-pagina`;
      }
    }

    // CMS detection from browser
    if (data.generatorMeta) {
      const existingCms = allChecks.find((c) => c.id === 'hygiene-cms');
      if (existingCms) {
        existingCms.status = 'partial';
        existingCms.score = 50;
        existingCms.description = `CMS gedetecteerd: "${data.generatorMeta}" — controleer of dit de laatste versie is`;
      }
    }
  } else {
    errors.push(`Browserlaag: ${browserResult.error.message}`);
  }

  const scoreResult = calculateScore(allChecks);
  const skippedChecks = allChecks.filter((c) => c.status === 'skipped');
  const activeChecks = allChecks.filter((c) => c.status !== 'skipped');

  return {
    ok: true,
    data: {
      url,
      scannedAt: new Date().toISOString(),
      overallScore: scoreResult.overallScore,
      grade: scoreResult.grade,
      categories: scoreResult.categories,
      checks: activeChecks,
      skippedChecks,
      errors,
    },
  };
}
```

- [ ] **Step 4: Create src/process/index.ts barrel**

```typescript
export { orchestrateScan } from './scan-orchestrator';
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/process/scan-orchestrator.test.ts
```
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/process/
git commit -m "Add scan orchestrator combining network and browser layers"
```

---

## Task 13: API Route — Scan Endpoint

**Files:**
- Create: `app/api/v1/scan/route.ts`
- Create: `app/api/v1/health/route.ts`

- [ ] **Step 1: Implement scan API route**

`app/api/v1/scan/route.ts`:
```typescript
import { NextResponse } from 'next/server';

import { ScanRequestSchema } from '@/types';
import { validateUrl } from '@/service/domains';
import { orchestrateScan } from '@/process/scan-orchestrator';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = ScanRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          type: 'https://siteguardian.publicvibes.nl/problems/validation-error',
          title: 'Validatiefout',
          status: 400,
          detail: parsed.error.issues.map((i) => i.message).join('; '),
          instance: '/api/v1/scan',
        },
        { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
      );
    }

    const urlResult = validateUrl(parsed.data.url);
    if (!urlResult.ok) {
      return NextResponse.json(
        {
          type: 'https://siteguardian.publicvibes.nl/problems/invalid-url',
          title: 'Ongeldige URL',
          status: 400,
          detail: urlResult.error.message,
          instance: '/api/v1/scan',
        },
        { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
      );
    }

    const result = await orchestrateScan(urlResult.data);

    if (!result.ok) {
      return NextResponse.json(
        {
          type: 'https://siteguardian.publicvibes.nl/problems/scan-failed',
          title: 'Scan mislukt',
          status: 500,
          detail: result.error.message,
          instance: '/api/v1/scan',
        },
        { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
      );
    }

    return NextResponse.json({
      ...result.data,
      _links: {
        self: { href: '/api/v1/scan' },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        type: 'https://siteguardian.publicvibes.nl/problems/internal-error',
        title: 'Interne fout',
        status: 500,
        detail: 'Er is een onverwachte fout opgetreden',
        instance: '/api/v1/scan',
      },
      { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
    );
  }
}
```

- [ ] **Step 2: Implement healthz endpoint**

`app/api/v1/healthz/route.ts`:
```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
```

- [ ] **Step 3: Implement readyz endpoint**

`app/api/v1/readyz/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { getRedisClient } from '@/data/redis';

export async function GET() {
  try {
    const redis = getRedisClient();
    await redis.ping();
    return NextResponse.json({ status: 'ok' });
  } catch {
    return NextResponse.json(
      {
        type: 'https://siteguardian.publicvibes.nl/problems/not-ready',
        title: 'Service niet gereed',
        status: 503,
        detail: 'Redis niet bereikbaar',
        instance: '/api/v1/readyz',
      },
      { status: 503, headers: { 'Content-Type': 'application/problem+json' } },
    );
  }
}
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add app/api/
git commit -m "Add scan and health API endpoints with RFC 9457 errors"
```

---

## Task 14: Landing Page UI

**Files:**
- Create: `src/ui/scan-form.tsx`
- Create: `src/ui/score-display.tsx`
- Create: `src/ui/report-view.tsx`
- Create: `src/ui/index.ts`
- Modify: `app/page.tsx`
- Create: `app/globals.css`

- [ ] **Step 1: Implement scan-form.tsx**

```tsx
'use client';

import { useState } from 'react';
import type { ScanReport } from '@/types';

interface ScanFormProps {
  onResult: (report: ScanReport) => void;
  onError: (message: string) => void;
}

export function ScanForm({ onResult, onError }: ScanFormProps) {
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [deep, setDeep] = useState(false);
  const [scanning, setScanning] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setScanning(true);

    try {
      const response = await fetch('/api/v1/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.startsWith('https://') ? url : `https://${url}`,
          email: email || undefined,
          deep,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        onError(error.detail ?? 'Scan mislukt');
        return;
      }

      const report = await response.json();
      onResult(report);
    } catch {
      onError('Kan de server niet bereiken');
    } finally {
      setScanning(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="url">Website URL</label>
        <input
          id="url"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://gemeente.nl"
          required
          disabled={scanning}
        />
      </div>

      <div>
        <label htmlFor="email">E-mailadres (optioneel, voor rapport per email)</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="naam@gemeente.nl"
          disabled={scanning}
        />
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={deep}
            onChange={(e) => setDeep(e.target.checked)}
            disabled={scanning}
          />
          Diepe scan (ook subpagina's controleren, duurt langer)
        </label>
      </div>

      <button type="submit" disabled={scanning}>
        {scanning ? 'Bezig met scannen...' : 'Start scan'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Implement score-display.tsx**

```tsx
import type { Grade } from '@/types';

const GRADE_COLORS: Record<Grade, string> = {
  A: '#22c55e',
  B: '#84cc16',
  C: '#eab308',
  D: '#f97316',
  F: '#ef4444',
};

const GRADE_LABELS: Record<Grade, string> = {
  A: 'Uitstekend',
  B: 'Goed',
  C: 'Voldoende',
  D: 'Onvoldoende',
  F: 'Kritiek',
};

interface ScoreDisplayProps {
  grade: Grade;
  score: number;
}

export function ScoreDisplay({ grade, score }: ScoreDisplayProps) {
  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <div
        style={{
          fontSize: '6rem',
          fontWeight: 'bold',
          color: GRADE_COLORS[grade],
          lineHeight: 1,
        }}
      >
        {grade}
      </div>
      <div style={{ fontSize: '1.5rem', marginTop: '0.5rem' }}>
        {score}% — {GRADE_LABELS[grade]}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement report-view.tsx**

```tsx
import type { ScanReport, CheckResult, CategoryResult } from '@/types';

const STATUS_ICONS: Record<string, string> = {
  pass: '[OK]',
  partial: '[!]',
  fail: '[X]',
  skipped: '[?]',
};

interface ReportViewProps {
  report: ScanReport;
}

export function ReportView({ report }: ReportViewProps) {
  return (
    <div>
      {report.categories.map((cat) => (
        <CategorySection
          key={cat.category}
          category={cat}
          checks={report.checks.filter((c) => c.category === cat.category)}
        />
      ))}

      {report.skippedChecks.length > 0 && (
        <section>
          <h2>Handmatig te controleren</h2>
          <ul>
            {report.skippedChecks.map((check) => (
              <li key={check.id}>{check.name}: {check.description}</li>
            ))}
          </ul>
        </section>
      )}

      {report.errors.length > 0 && (
        <section>
          <h2>Technische details</h2>
          <ul>
            {report.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function CategorySection({ category, checks }: { category: CategoryResult; checks: CheckResult[] }) {
  return (
    <section>
      <h2>{category.label} — {category.score}%</h2>
      <ul>
        {checks.map((check) => (
          <li key={check.id}>
            {STATUS_ICONS[check.status]} <strong>{check.name}</strong>: {check.description}
            {check.status === 'fail' && check.fix && (
              <div><em>Aanbeveling: {check.fix}</em></div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Create src/ui/index.ts barrel**

```typescript
export { ScanForm } from './scan-form';
export { ScoreDisplay } from './score-display';
export { ReportView } from './report-view';
```

- [ ] **Step 5: Update app/page.tsx to use components**

```tsx
'use client';

import { useState } from 'react';
import type { ScanReport } from '@/types';
import { ScanForm, ScoreDisplay, ReportView } from '@/ui';

export default function Home() {
  const [report, setReport] = useState<ScanReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <h1>Site Guardian</h1>
      <p>
        Controleer of uw website voldoet aan de eisen voor cookies, beveiliging,
        digitale soevereiniteit, privacy, toegankelijkheid en technische hygiëne.
      </p>

      <ScanForm
        onResult={(r) => { setReport(r); setError(null); }}
        onError={(msg) => { setError(msg); setReport(null); }}
      />

      {error && <div style={{ color: 'red', marginTop: '1rem' }}>{error}</div>}

      {report && (
        <>
          <ScoreDisplay grade={report.grade} score={report.overallScore} />
          <ReportView report={report} />
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 6: Verify build**

```bash
npm run typecheck && npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/ui/ app/page.tsx app/globals.css
git commit -m "Add landing page with scan form, score display, and report view"
```

---

## Task 15: README & Final Verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README.md**

Write README with:
- Project description (what it does, who it's for)
- Getting started (prerequisites, install, run)
- Architecture overview (5-layer, scan categories)
- Dependency license table (all packages with license)
- License section (EUPL-1.2)

- [ ] **Step 2: Run full test suite**

```bash
npm run test
npm run typecheck
npm run lint
```

- [ ] **Step 3: Run dev server and manually test**

```bash
npm run dev
# Open http://localhost:8080
# Enter a URL (e.g., https://gemeente.nl)
# Verify scan runs and results appear
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "Add README with documentation and dependency license table"
```

---

## Task 16: OpenAPI Spec & Type Generation

**Files:**
- Create: `api/specs/site-guardian.yaml`
- Create: `src/integration/types/` (generated)

- [ ] **Step 1: Write OpenAPI 3.1 spec**

`api/specs/site-guardian.yaml`: Define all endpoints (POST /api/v1/scan, POST/DELETE /api/v1/subscribers, GET /api/v1/healthz, GET /api/v1/readyz) with request/response schemas matching the Zod schemas in `src/types.ts`. Include RFC 9457 error responses.

- [ ] **Step 2: Install openapi-typescript**

```bash
npm install -D openapi-typescript
```

- [ ] **Step 3: Add type generation script to package.json**

```json
"generate:types": "npx openapi-typescript api/specs/site-guardian.yaml -o src/integration/types/site-guardian.ts"
```

- [ ] **Step 4: Generate types**

```bash
npm run generate:types
```

- [ ] **Step 5: Commit**

```bash
git add api/specs/ src/integration/types/ package.json
git commit -m "Add OpenAPI 3.1 spec and generate API types"
```

---

## Task 17: Redis Client & Rate Limiter

**Files:**
- Create: `src/data/redis.ts`
- Create: `src/data/redis.test.ts`
- Create: `src/data/rate-limiter.ts`
- Create: `src/data/rate-limiter.test.ts`

- [ ] **Step 1: Write failing tests for Redis client**

`src/data/redis.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { getRedisClient } from './redis';

vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      ping: vi.fn().mockResolvedValue('PONG'),
      quit: vi.fn().mockResolvedValue('OK'),
    })),
  };
});

describe('getRedisClient', () => {
  it('should return a Redis client', () => {
    const client = getRedisClient();
    expect(client).toBeDefined();
  });
});
```

- [ ] **Step 2: Implement redis.ts**

```typescript
import Redis from 'ioredis';

let client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!client) {
    client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return client;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
```

- [ ] **Step 3: Write failing tests for rate limiter**

`src/data/rate-limiter.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkRateLimit } from './rate-limiter';

const mockRedis = {
  zrangebyscore: vi.fn().mockResolvedValue([]),
  zadd: vi.fn().mockResolvedValue(1),
  zremrangebyscore: vi.fn().mockResolvedValue(0),
  expire: vi.fn().mockResolvedValue(1),
};

vi.mock('./redis', () => ({
  getRedisClient: () => mockRedis,
}));

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow request when under limit', async () => {
    mockRedis.zrangebyscore.mockResolvedValue(['t1', 't2']);
    const result = await checkRateLimit('127.0.0.1', 'quick', 3);
    expect(result.allowed).toBe(true);
  });

  it('should deny request when at limit', async () => {
    mockRedis.zrangebyscore.mockResolvedValue(['t1', 't2', 't3']);
    const result = await checkRateLimit('127.0.0.1', 'quick', 3);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Implement rate-limiter.ts**

```typescript
import { getRedisClient } from './redis';

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

const WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function checkRateLimit(
  ip: string,
  scanType: 'quick' | 'deep',
  maxRequests: number,
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const key = `rate:${scanType}:${ip}`;
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Clean old entries
  await redis.zremrangebyscore(key, 0, windowStart);

  // Count requests in window
  const requests = await redis.zrangebyscore(key, windowStart, now);

  if (requests.length >= maxRequests) {
    const oldestInWindow = parseInt(requests[0], 10);
    const retryAfterSeconds = Math.ceil((oldestInWindow + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }

  // Add current request
  await redis.zadd(key, now, `${now}`);
  await redis.expire(key, Math.ceil(WINDOW_MS / 1000));

  return { allowed: true, retryAfterSeconds: 0 };
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/data/redis.test.ts src/data/rate-limiter.test.ts
```

- [ ] **Step 6: Update src/data/index.ts barrel**

```typescript
export { validateEnv, type Env } from './env';
export { getRedisClient, closeRedis } from './redis';
export { checkRateLimit } from './rate-limiter';
```

- [ ] **Step 7: Commit**

```bash
git add src/data/redis.ts src/data/redis.test.ts src/data/rate-limiter.ts src/data/rate-limiter.test.ts src/data/index.ts
git commit -m "Add Redis client and sliding window rate limiter"
```

---

## Task 18: Resend Email Adapter & HTML Reporter

**Files:**
- Create: `src/integration/resend-adapter.ts`
- Create: `src/integration/resend-adapter.test.ts`
- Create: `src/service/reporter.ts`
- Create: `src/service/reporter.test.ts`

- [ ] **Step 1: Write failing tests for reporter**

`src/service/reporter.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { generateHtmlReport } from './reporter';
import type { ScanReport } from '@/types';

describe('generateHtmlReport', () => {
  const mockReport: ScanReport = {
    url: 'https://gemeente.nl',
    scannedAt: '2026-03-20T12:00:00Z',
    overallScore: 75,
    grade: 'B',
    categories: [],
    checks: [],
    skippedChecks: [],
    errors: [],
  };

  it('should generate HTML containing the grade', () => {
    const html = generateHtmlReport(mockReport);
    expect(html).toContain('B');
    expect(html).toContain('75%');
    expect(html).toContain('gemeente.nl');
  });

  it('should generate valid HTML', () => {
    const html = generateHtmlReport(mockReport);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });
});
```

- [ ] **Step 2: Write failing tests for Resend adapter**

`src/integration/resend-adapter.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { sendReportEmail } from './resend-adapter';

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
    },
  })),
}));

describe('sendReportEmail', () => {
  it('should send email and return success', async () => {
    const result = await sendReportEmail('test@example.com', '<html>Report</html>', 'Test Subject');
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 3: Implement reporter.ts**

Generate Dutch HTML report with grade, category scores, findings, and fix recommendations. Include inline CSS for email compatibility.

- [ ] **Step 4: Implement resend-adapter.ts**

```typescript
import { Resend } from 'resend';
import type { Result } from '@/types';

export async function sendReportEmail(
  to: string,
  html: string,
  subject: string,
): Promise<Result<{ id: string }>> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SCAN_EMAIL_FROM;

  if (!apiKey || !from) {
    return { ok: false, error: { code: 'EMAIL_NOT_CONFIGURED', message: 'Email is niet geconfigureerd' } };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({ from, to, subject, html });

    if (error) {
      return { ok: false, error: { code: 'EMAIL_SEND_FAILED', message: error.message } };
    }

    return { ok: true, data: { id: data?.id ?? 'unknown' } };
  } catch (err) {
    return {
      ok: false,
      error: { code: 'EMAIL_ERROR', message: err instanceof Error ? err.message : 'Onbekende fout' },
    };
  }
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/service/reporter.test.ts src/integration/resend-adapter.test.ts
```

- [ ] **Step 6: Update integration barrel**

```typescript
export { sendReportEmail } from './resend-adapter';
```

- [ ] **Step 7: Integrate email sending in scan API route**

In `app/api/v1/scan/route.ts`, after successful scan: if `email` provided and Resend configured, generate HTML report and send email.

- [ ] **Step 8: Commit**

```bash
git add src/service/reporter.ts src/service/reporter.test.ts src/integration/resend-adapter.ts src/integration/resend-adapter.test.ts src/integration/index.ts app/api/v1/scan/route.ts
git commit -m "Add HTML reporter and Resend email adapter"
```

---

## Task 19: Integrate Rate Limiting in Scan API

**Files:**
- Modify: `app/api/v1/scan/route.ts`

- [ ] **Step 1: Add rate limiting to scan endpoint**

At the start of the POST handler, before validation:
```typescript
import { checkRateLimit } from '@/data/rate-limiter';

// Extract IP from request headers
const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
const scanType = parsed.data.deep ? 'deep' : 'quick';
const maxRequests = scanType === 'deep' ? 1 : 3;

const rateResult = await checkRateLimit(ip, scanType, maxRequests);
if (!rateResult.allowed) {
  return NextResponse.json(
    {
      type: 'https://siteguardian.publicvibes.nl/problems/rate-limited',
      title: 'Te veel verzoeken',
      status: 429,
      detail: `Maximaal ${maxRequests} ${scanType} scan(s) per uur. Probeer het over ${rateResult.retryAfterSeconds} seconden opnieuw.`,
      instance: '/api/v1/scan',
    },
    {
      status: 429,
      headers: {
        'Content-Type': 'application/problem+json',
        'Retry-After': String(rateResult.retryAfterSeconds),
      },
    },
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add app/api/v1/scan/route.ts
git commit -m "Add rate limiting to scan endpoint (3/hr quick, 1/hr deep)"
```

---

## Task 20: Missing Scanner Checks

Add the checks from the spec that were missing in the initial scanner tasks.

**Files:**
- Modify: `src/service/scanner/headers.ts` — add DNSSEC check stub (skipped, requires DNS library)
- Modify: `src/service/scanner/sovereignty.ts` — add hosting geolocation check, iframe detection
- Modify: `src/service/scanner/privacy.ts` — add "forms via HTTPS" check
- Modify: `src/service/scanner/hygiene.ts` — add TLS version check, open directory listing check

- [ ] **Step 1: Add forms-via-HTTPS check to privacy.ts**

Add to `checkPrivacy()` return array:
```typescript
function checkFormsHttps(forms: FormInfo[]): CheckResult {
  const insecure = forms.filter((f) => {
    try {
      const url = new URL(f.action, 'https://placeholder.local');
      return url.protocol === 'http:';
    } catch {
      return false;
    }
  });

  return {
    id: 'privacy-forms-https',
    name: 'Formulieren via HTTPS',
    category: Category.PRIVACY,
    status: insecure.length > 0 ? CheckStatus.FAIL : CheckStatus.PASS,
    score: insecure.length > 0 ? 0 : 100,
    description: insecure.length > 0
      ? `${insecure.length} formulier(en) verzendt via onbeveiligd HTTP`
      : 'Alle formulieren gebruiken HTTPS',
    impact: 'Formulierdata verstuurd via HTTP is onversleuteld en onderschepbaar',
    fix: 'Wijzig alle form actions naar HTTPS URLs',
    confidence: 'hoog',
  };
}
```

- [ ] **Step 2: Add iframe sovereignty check to sovereignty.ts**

Add to `checkSovereignty()`: parse `iframes` parameter, classify iframe src domains as EU/US/unknown.

- [ ] **Step 3: Add TLS version and directory listing checks to hygiene.ts**

Stub these checks — they require `tls.connect()` and HTTP probing which will be implemented when the network scanner is enhanced. For now, return `skipped` status.

- [ ] **Step 4: Update tests for new checks**

Add test cases for each new check.

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add src/service/scanner/
git commit -m "Add missing scanner checks: forms HTTPS, iframe sovereignty, TLS version stubs"
```

---

## Task 21: E2E Tests met Playwright

**Test site:** `https://www.rijssen-holten.nl/` (echte gemeente-website)

**Files:**
- Create: `e2e/scan-flow.spec.ts`
- Create: `playwright.config.ts`

- [ ] **Step 1: Install Playwright test runner**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Create playwright.config.ts**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 120000, // scans can take time
  use: {
    baseURL: 'http://localhost:8080',
  },
  webServer: {
    command: 'npm run dev',
    port: 8080,
    reuseExistingServer: true,
    timeout: 30000,
  },
});
```

- [ ] **Step 3: Write happy flow E2E test**

`e2e/scan-flow.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Scan flow', () => {

  test('happy: scan gemeente Rijssen-Holten and show results', async ({ page }) => {
    await page.goto('/');

    // Landing page loads
    await expect(page.locator('h1')).toContainText('Site Guardian');

    // Fill in URL
    await page.fill('#url', 'https://www.rijssen-holten.nl/');

    // Start scan
    await page.click('button[type="submit"]');

    // Wait for results (scan takes time)
    await expect(page.locator('text=/[A-F]/'))
      .toBeVisible({ timeout: 90000 });

    // Overall score is visible (A-F letter)
    const gradeText = await page.textContent('body');
    expect(gradeText).toMatch(/[A-F]/);

    // Category sections are rendered
    await expect(page.locator('text=Cookies')).toBeVisible();
    await expect(page.locator('text=Security Headers')).toBeVisible();
    await expect(page.locator('text=Soevereiniteit')).toBeVisible();
    await expect(page.locator('text=Privacy')).toBeVisible();
    await expect(page.locator('text=Toegankelijkheid')).toBeVisible();
    await expect(page.locator('text=Hygiëne')).toBeVisible();

    // At least some checks ran
    await expect(page.locator('text=/\\[OK\\]|\\[X\\]|\\[!\\]/')).toHaveCount(
      { minimum: 5 },
      { timeout: 5000 },
    );
  });

  test('happy: scan with email field filled (no actual send without API key)', async ({ page }) => {
    await page.goto('/');
    await page.fill('#url', 'https://www.rijssen-holten.nl/');
    await page.fill('#email', 'test@example.com');
    await page.click('button[type="submit"]');

    // Should still show results in browser regardless of email
    await expect(page.locator('text=/[A-F]/'))
      .toBeVisible({ timeout: 90000 });
  });

  test('unhappy: reject invalid URL (http instead of https)', async ({ page }) => {
    await page.goto('/');
    await page.fill('#url', 'http://www.rijssen-holten.nl/');
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('text=/HTTPS|https/i')).toBeVisible({ timeout: 10000 });
  });

  test('unhappy: reject private IP address', async ({ page }) => {
    await page.goto('/');
    await page.fill('#url', 'https://192.168.1.1');
    await page.click('button[type="submit"]');

    // Should show error message about blocked address
    await expect(page.locator('text=/niet toegestaan|blocked/i')).toBeVisible({ timeout: 10000 });
  });

  test('unhappy: reject empty URL', async ({ page }) => {
    await page.goto('/');
    // Don't fill URL, just click submit
    await page.click('button[type="submit"]');

    // Browser validation should prevent submit (required field)
    // URL field should still be empty
    const urlValue = await page.inputValue('#url');
    expect(urlValue).toBe('');
  });

  test('unhappy: reject localhost', async ({ page }) => {
    await page.goto('/');
    await page.fill('#url', 'https://localhost');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=/niet toegestaan|blocked/i')).toBeVisible({ timeout: 10000 });
  });

});
```

- [ ] **Step 4: Add E2E test script to package.json**

```json
"test:e2e": "npx playwright test"
```

- [ ] **Step 5: Run E2E tests**

```bash
npm run test:e2e
```

- [ ] **Step 6: Commit**

```bash
git add e2e/ playwright.config.ts package.json
git commit -m "Add E2E tests with Playwright against gemeente Rijssen-Holten"
```

---

## Execution Order Summary

| Task | Description | Dependencies |
|------|------------|-------------|
| 1 | Project scaffolding | None |
| 2 | Shared types + env validation | Task 1 |
| 3 | URL validation + SSRF protection | Task 2 |
| 4 | Security headers scanner | Task 2 |
| 5 | Sovereignty domain DB + scanner | Task 2 |
| 6 | Cookies & tracking scanner | Task 2 |
| 7 | Privacy + accessibility scanners | Task 2 |
| 8 | Technical hygiene scanner | Task 2 |
| 9 | Scoring engine | Task 2 |
| 10 | Network layer scanner | Task 2 |
| 11 | Browser layer scanner (Playwright) | Task 2 |
| 12 | Scan orchestrator | Tasks 3-11 |
| 16 | OpenAPI spec + type generation | Task 2 |
| 17 | Redis client + rate limiter | Task 2 |
| 18 | Resend email adapter + reporter | Task 12 |
| 13 | API routes (scan, health) | Tasks 12, 16, 17 |
| 19 | Integrate rate limiting in scan API | Tasks 13, 17 |
| 20 | Missing scanner checks | Tasks 4-8 |
| 14 | Landing page UI | Task 12 |
| 21 | E2E tests (Playwright, rijssen-holten.nl) | Tasks 14, 19 |
| 15 | README + verification | Tasks 13-14, 18-21 |

**Parallelizable:** Tasks 3-11, 16, 17 can be developed in parallel (independent modules). Tasks 13, 14, 18 can be parallel after Task 12. Tasks 19 and 20 can be parallel.
