I'm attaching dashboard.html (a working front-end prototype called "Corble Workspace") and my landing page (index.html + assets/ with corble-logo-light.webp and corble-logo-dark.webp). Turn them into one Next.js app where the dashboard is a real, authenticated, database-backed internal workspace at /workspace, reachable from the landing page.

STACK
- Next.js 15 (App Router) + TypeScript, Node 20
- PostgreSQL + Prisma ORM (migrations, seed script)
- Auth.js (NextAuth v5) with credentials login (email + password, bcrypt). No public sign-up; users are created by seed or by an admin in Settings.
- Zod for validation on every server input
- Plain CSS (CSS modules or one globals.css). Reuse the dashboard's existing CSS variables and styles so the look stays pixel-identical, including dark/light theme and the Corble logo swap.
- docker-compose.yml with a Postgres service, a .env.example, and README with exact setup steps (install, db up, migrate, seed, dev, build, deploy)

ROUTES
- / : my landing page, ported into the app (keep its design, copy, theme toggle, accent switcher, nav). Add a "Client Portal / Workspace" button in the navbar and mobile menu linking to /workspace.
- /login : styled to match the brand, redirects to /workspace after login
- /workspace : the dashboard (Overview), protected by middleware; unauthenticated users go to /login
- /workspace/leads, /projects, /tasks, /finance, /team, /calendar, /files, /templates, /reports, /settings : one route per sidebar item, sharing a layout with the sidebar, top bar, search box, theme button and toast
- /api/* route handlers or Server Actions for all mutations (pick one approach and use it consistently)

DATABASE (Prisma models, derived from the prototype's data)
- User (id, name, email, passwordHash, role ADMIN|MEMBER, createdAt)
- Lead (name, contactPerson, service, source, status NEW|CONTACTED|QUALIFIED|PROPOSAL_SENT|WON|LOST, estValue, nextFollowUp, ownerId?)
- Project (name, clientName, leadId?, service, status PLANNING|IN_PROGRESS|REVIEW|DELIVERED|COMPLETED, progress 0-100, dueDate, ownerId, budget)
- Task (title, projectId?, assigneeId, priority LOW|MEDIUM|HIGH, status TODO|IN_PROGRESS|DONE|BLOCKED, dueDate)
- FinanceRecord (type INVOICE|PAYMENT|EXPENSE, description, amount, status PENDING|RECEIVED|PAID|OVERDUE, date, projectId?)
- Activity (message, detail, createdAt, userId) : written automatically on create/update/delete actions
- Template (name, description/steps) and Settings (companyName, currency EGP|USD, timezone, theme) 
- FileAsset (name, size, mimeType, storageKey, projectId?, uploadedById)
- Use Decimal or integer minor units for money, proper indexes on status/due dates, createdAt/updatedAt everywhere.
- Seed script loads the exact sample data from the prototype (4 leads, 3 projects, 4 tasks, 3 finance records, 3 team members, activity) plus one admin user.

EVERY FUNCTION MUST WORK (replace localStorage with the database)
- Overview: KPI cards (total leads, active projects, open tasks + high-priority count, cash received, follow-ups in pipeline), lead pipeline bars, upcoming follow-ups, active projects, recent activity: all computed from real DB queries. Replace the "illustrative" bar chart with real monthly aggregates of payments vs expenses for the current year.
- Leads/CRM: add lead (modal), edit lead, change status inline (dropdown saves immediately), delete, follow-up date, estimated value. Add "Convert to project" when status becomes Won.
- Projects: create, edit, status dropdown, progress, due date, owner, budget, delete. "Use template" on Templates creates a project (and starter tasks from the template steps).
- Tasks: add, change status inline, change priority, assign to a team member, delete, filter by status/assignee.
- Finance: add/edit/delete records, status updates, totals for received / pending / expenses.
- Team: list users with live open-task counts; admins can add/remove users and reset passwords.
- Calendar: real month grid showing task due dates and lead follow-ups from the DB, with click-through to the item; also keep the upcoming lists.
- Files: real upload/download/delete. Use an S3-compatible adapter (Cloudflare R2 or MinIO via env vars) with presigned URLs; if env vars are missing, fall back to a local ./uploads folder in development. Validate type and size (max 10 MB), never expose bucket paths publicly.
- Templates: the 3 existing templates stored in the DB, "Use template" works as described above.
- Reports: sales pipeline value, delivery (completed/total), task completion %, revenue vs expenses; add CSV export for leads, projects, tasks and finance.
- Settings: company name, currency, timezone and theme saved to the DB and applied across the app (currency formatting everywhere, theme persisted per user).
- Global search box filters the current view (server-side query param, debounced).
- Theme toggle (dark/light) persisted per user, logo swaps correctly.
- Mobile sidebar menu button works. Toasts for success/error on every action. Confirm dialogs for deletes. Loading and empty states.
- Remove the "Prototype mode / localStorage" notice and "Demo" badge.

SECURITY
- Hash passwords with bcrypt, httpOnly secure session cookies, CSRF-safe mutations, rate-limit /login.
- Every route handler / server action checks the session and role. Never trust client input; validate with Zod and use Prisma parameterized queries only.
- Escape/sanitize all rendered user text (the prototype's safe() function must not be needed because React escapes by default; confirm nothing uses dangerouslySetInnerHTML).
- Security headers (CSP, X-Frame-Options, Referrer-Policy) in next.config.
- Secrets only in .env; ship .env.example.

CODE QUALITY
- Server Components for data fetching, small Client Components only for interactive parts (modals, inline selects, theme toggle).
- Folder structure: app/, components/, lib/ (db.ts, auth.ts, validators.ts, format.ts), prisma/ (schema.prisma, seed.ts).
- Strict TypeScript, no any, ESLint clean, `npm run build` must pass.

DELIVERABLES
1. Full project file tree
2. All source files, complete (no placeholders or "..." sections)
3. prisma/schema.prisma and seed.ts
4. README with setup and deployment steps (local with Docker, and production on a VPS/Vercel + managed Postgres)
5. A short checklist at the end confirming each dashboard function above is implemented

Work in this order: schema + seed → auth + layout + landing link → each module one by one → file uploads → reports/CSV → polish.