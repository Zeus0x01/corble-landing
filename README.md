# Corble — Landing + Workspace

A dark/lime Sift-inspired landing page (Next.js App Router) with an authenticated Postgres-backed client workspace (`/workspace`) built on the `dashboard.html` prototype.

## Stack

- **Next.js 15** (App Router, TypeScript, strict mode)
- **Prisma 6 + PostgreSQL** — Supabase in production (Vercel), local Docker in development
- **Auth.js (NextAuth v5)** — credentials login, bcrypt password hashing, JWT sessions
- **Zod validation** on every server action / API route
- **Server Actions** for all mutations
- **S3-compatible uploads** — Cloudflare R2 (or MinIO) with a local `./uploads` fallback

## Features

Workspace modules (all with CRUD, search, toasts, keyboard-escapable modals):

| Route | Module |
|---|---|
| `/workspace` | Overview: pipeline value, YTD finance, weekly tasks, activity feed |
| `/workspace/leads` | Leads + status pipeline + convert-to-project |
| `/workspace/projects` | Projects with progress bars, linked lead + owner |
| `/workspace/tasks` | Tasks, due dates, assignee, inline status |
| `/workspace/tasks/team` | Team Tasks: overdue / claimable / handover-in-progress board |
| `/workspace/notifications` | Per-user notification feed, mark read / mark all read |
| `/workspace/deliverables` | Deliverable versions + admin review (approve / request changes) |
| `/workspace/leads/incoming` | Incoming Leads: research notes, verification checks, promote / reject |
| `/workspace/automation` | Automation projects with phase gates and final delivery acceptance |
| `/workspace/github` | Websites (GitHub): branch file browsing, single-file edit & commit, ZIP download |
| `/workspace/vercel` | Deployments: connect Vercel project, fire preview / production deploys |
| `/workspace/finance` | Income / expenses with status + category |
| `/workspace/team` | Admin-only: add/remove users, reset passwords |
| `/workspace/calendar` | Tasks + follow-ups by month |
| `/workspace/files` | File vault (upload / delete / download, 10 MB max) |
| `/workspace/templates` | Project templates → one-click create |
| `/workspace/reports` | Finance + pipeline stats |
| `/workspace/settings` | Company profile, currency, timezone; per-user theme |

Plus: `/login`, CSV export API (`/api/export/leads|projects|tasks|finance|incoming|deliverables`), file upload/download API, protected landing lead endpoint (`/api/lead`).

### Task handover & deliverable flow

1. A task owner marks a task **eligible for assistance / possible handover** (`⤵` on My Tasks) — overdue alone never makes a task claimable.
2. Teammates request a takeover from **Team Tasks**; the owner (or any admin) approves once, assigning the requester and keeping the original owner in the audit trail. Requests dedupe per requester and auto-close when the owner completes or reassigns the task.
3. Work products go through **Deliverables** (versioned), where admins approve or request changes; each review notifies the submitter.

### Incoming leads pipeline (n8n → verification → Final Leads)

- **n8n ingest**: `POST /api/ingest/leads` with header `x-ingest-secret: $INGEST_WEBHOOK_SECRET`, JSON body `{ workflowId, recordId, fields: { company, email, phone, website, ... } }`. Idempotent per `workflowId:recordId`; duplicate emails/domains land flagged `DUPLICATE`, every run is rate-limited (120/min per IP).
- **CSV import**: admins upload from Incoming Leads (preview → commit), rows land in a batch with dup/invalid counts.
- **Verification**: one-click email-syntax / DNS / website-reachability checks (real DNS + 8s HTTP fetch, recorded as checks) + manual review entries + research notes with source URLs.
- **Promotion**: promoting creates a Final Lead (owner = promoter), blocking when a Final record already matches email/company (visible conflict state).

### Automation phase-gated delivery

Automation projects own ordered phases; a phase can only be submitted when its prerequisite is APPROVED, changes bump an internal version, and owners assemble a final delivery package that the designated accepter confirms — only then the project flips to DELIVERED.

### GitHub / Vercel integrations

- GitHub: connections are (project, owner/repo, branch). Browsing is read-only for members; **admin-only** commits, and hard-refused on `main`/`master`/`production` branches. Folder ZIP download / single-file download. Optimistic-concurrency commits (sha conflict → 409).
- Vercel: connect a project ID, then preview or production deploys; production accepts Vercel's target directly and every attempt is recorded (including token-not-configured failures), surfaced on `/workspace/vercel`.

## Development (local)

```bash
npm install
docker compose up -d          # postgres 16 on :5432
cp .env.example .env          # edit if needed
npm run db:up                 # postgres 16 on :5432
cp .env.example .env          # edit if needed
npm run db:migrate            # prisma migrate dev
npm run db:seed               # demo data incl. admin user
npm run dev
```

Login at `/login` with the seeded admin: `admin@corble.net` / `CorbleDemo123!`.

## Production — Supabase + Vercel

The database is hosted on **Supabase**.

1. **Create a Supabase project** (any region close to your users).
2. In *Project Settings → Database*, get the **Connection String**:
   - **Prisma / pooled** (Transaction pooler, port `6543`) — used at runtime on Vercel:
     ```
     postgresql://postgres.PROJECT:YOUR-PORT-PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
     ```
   - the **direct** one (port `5432`) is only for running migrations from your machine.
3. **Apply the schema from your machine** (one time):
   ```bash
   DATABASE_URL="<pooled-or-direct-url>" npx prisma migrate deploy
   DATABASE_URL="<direct-url>" npx prisma db seed   # or use tsx: npx tsx prisma/seed.ts
   ```
4. **On Vercel** (Project → Settings → Environment Variables), add:
   - `DATABASE_URL` → the **pooled** Supabase URL (with `?pgbouncer=true&connection_limit=1`)
   - `AUTH_SECRET` → long random string (`openssl rand -base64 32`)
   - `AUTH_URL` → `https://your-domain.com`
   - optional `S3_*` keys if using R2/MinIO for uploads
   - optional `INGEST_WEBHOOK_SECRET` (n8n lead ingest), `GITHUB_TOKEN`, `VERCEL_TOKEN` (workspace integrations)
5. **Deploy**:
   ```bash
   vercel --prod
   ```
6. Verify `/login`, then the workspace modules with the seeded admin.

> `db push` style sync: if you don't want migration files, run
> `DATABASE_URL="<direct-url>" npx prisma db push` once per schema change.

## Seed users

| Email | Role |
|---|---|
| admin@corble.net | ADMIN |
| nour@corble.net | MEMBER |
| youssef@corble.net | MEMBER |

Password for all seeded users in development: `CorbleDemo123!` (change after first login — admin can reset any password from `/workspace/team`).

There is **no public signup** — admins create team members from `/workspace/team`.

## Scripts

```
npm run dev         next dev
npm run build       next build
npm run typecheck   tsc --noEmit
npm run test        node test runner via tsx (validators / zip / csv / guards)
npm run db:up       docker compose up -d
npm run db:migrate  prisma migrate dev
npm run db:seed     prisma db seed
vercel --prod       deploy (requires Supabase env vars, see above)
```

## Security notes

- Middleware protects all `/workspace/:path*` routes (edge-safe session cookie check; full validation happens server-side per request).
- All mutations are validated with Zod before hitting Prisma; activity is logged.
- `next.config.ts` sets CSP (relaxed for Next's inline bootstrap), `X-Frame-Options: DENY`, `nosniff`, `referrer-policy`, permission policy.
- File uploads are size/MIME-restricted and stored outside the web root; downloads always go through an authenticated API route.
- Ingest webhook requires the `x-ingest-secret` header (timing-safe compare) + per-IP rate limit; CSV imports preview before commit and stay under 2 MB / 5k rows.
- GitHub file commits are admin-only and never target `main`/`master`/`production`; Vercel production deploys require an explicit `confirm` flag; both record an audit trail.
