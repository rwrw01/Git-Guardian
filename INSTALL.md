# Installation and deployment

## Prerequisites

- Node.js >= 20
- npm or pnpm
- [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`)
- A Vercel account with a Pro plan (required for 5-minute function timeout on daily scans)

## Accounts and keys you need

| Service | What to create | Link |
|---------|---------------|------|
| GitHub | Personal Access Token (read-only, public repos scope) | [github.com/settings/tokens](https://github.com/settings/tokens) |
| GitHub | OAuth App (for admin portal login) | [github.com/settings/developers](https://github.com/settings/developers) |
| Resend | API key + verified sender domain | [resend.com/api-keys](https://resend.com/api-keys) |
| DeepSeek | API key (optional, only for owner AI analysis) | [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) |
| Vercel | Upstash Redis store (via Marketplace) | [vercel.com/dashboard/stores](https://vercel.com/dashboard/stores) |

## Step 1: Clone and install

```bash
git clone https://github.com/rwrw01/Git-Guardian.git
cd Git-Guardian
npm install
```

## Step 2: Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```bash
# Required
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SCAN_EMAIL_FROM=scan@yourdomain.com
CRON_SECRET=a-long-random-string-for-cron-auth

# Upstash Redis (auto-populated by vercel env pull after linking store)
KV_REST_API_URL=https://your-kv-store.kv.vercel-storage.com
KV_REST_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Admin portal — GitHub OAuth
GITHUB_CLIENT_ID=Ov23li_xxxxxxxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AUTH_SECRET=openssl-rand-hex-32-output-here
ADMIN_GITHUB_USERS=rwrw01

# Optional (owner-only AI analysis)
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

| Variable | Required | Purpose |
|----------|----------|---------|
| `GITHUB_TOKEN` | Yes | GitHub PAT for reading public repos and file content |
| `RESEND_API_KEY` | Yes | Resend API key for sending email reports |
| `SCAN_EMAIL_FROM` | Yes | Sender address shown in reports (must be verified in Resend) |
| `CRON_SECRET` | Yes | Bearer token that Vercel sends with cron requests |
| `KV_REST_API_URL` | Yes | Upstash Redis connection URL |
| `KV_REST_API_TOKEN` | Yes | Upstash Redis authentication token |
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth App client ID (for admin portal) |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth App client secret |
| `AUTH_SECRET` | Yes | NextAuth session encryption key (`openssl rand -hex 32`) |
| `ADMIN_GITHUB_USERS` | Yes | Comma-separated GitHub usernames allowed to access admin portal |
| `DEEPSEEK_API_KEY` | No | DeepSeek API key for AI-powered code analysis (owner scans only) |

**Security notes:**
- `DEEPSEEK_API_KEY` is stored as a Vercel backend environment variable only. Never exposed client-side.
- `ADMIN_GITHUB_USERS` is a whitelist — only these GitHub accounts can log into the admin portal.
- `AUTH_SECRET` encrypts JWT sessions. Generate with `openssl rand -hex 32`.
- All admin actions are logged in an immutable audit trail.

### Setting up GitHub OAuth App

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - Application name: `Git Guardian`
   - Homepage URL: `https://your-vercel-url.vercel.app`
   - Authorization callback URL: `https://your-vercel-url.vercel.app/api/auth/callback/github`
4. Copy the **Client ID** → `GITHUB_CLIENT_ID`
5. Generate a **Client Secret** → `GITHUB_CLIENT_SECRET`

## Step 3: Link Vercel project and KV store

```bash
vercel link
vercel env pull .env.local
```

This pulls the KV connection variables automatically if you have already created a KV store in the Vercel dashboard and linked it to your project.

## Step 4: Run locally

```bash
vercel dev
```

The landing page is available at `http://localhost:3000`. API routes are at `/api/scan`, `/api/scan-once`, and `/api/subscribers`.

## Step 5: Test

```bash
# Trigger a one-time scan
curl -X POST http://localhost:3000/api/scan-once \
  -H "Content-Type: application/json" \
  -d '{"githubUsername": "your-username", "email": "your@email.com"}'

# Simulate the daily cron
curl -X POST http://localhost:3000/api/scan \
  -H "authorization: Bearer YOUR_CRON_SECRET"
```

## Step 6: Type check

```bash
npx tsc --noEmit
```

## Step 7: Deploy to production

```bash
vercel deploy --prod
```

After deployment, add all environment variables in the Vercel dashboard under **Settings > Environment Variables** if you haven't already via `vercel env add`.

The daily cron runs automatically at 06:00 UTC. Configuration is in `vercel.json`:

```json
{
  "crons": [{ "path": "/api/scan", "schedule": "0 6 * * *" }],
  "functions": {
    "api/scan.ts": { "maxDuration": 300 },
    "api/scan-once.ts": { "maxDuration": 120 }
  }
}
```

## Verify deployment

1. Visit your Vercel URL — the landing page should load
2. Submit a scan via the web form — you should receive an email
3. Check Vercel dashboard **Logs** for function execution
4. Check Vercel dashboard **Cron Jobs** to confirm the schedule is active
5. Test with a repo that contains known patterns (e.g., a test repo with a dummy AWS key format)
