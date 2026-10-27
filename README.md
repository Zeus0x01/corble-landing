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
| `/workspace/finance` | Income / expenses with status + category |
| `/workspace/team` | Admin-only: add/remove users, reset passwords |
| `/workspace/calendar` | Tasks + follow-ups by month |
| `/workspace/files` | File vault (upload / delete / download, 10 MB max) |
| `/workspace/templates` | Project templates → one-click create |
| `/workspace/reports` | Finance + pipeline stats |
| `/workspace/settings` | Company profile, currency, timezone; per-user theme |

Plus: `/login`, CSV export API (`/api/export/leads|projects|tasks|finance`), file upload/download API, protected landing lead endpoint (`/api/lead`).

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
