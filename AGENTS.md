# AGENTS.md — Wonder CRM

Mobile-first real estate sales CRM for property brokerages. Next.js 15 App Router + React 19,
TypeScript, Tailwind CSS v4, Supabase (Postgres/Auth/RLS), lucide-react. Two roles: `Admin`
and `Sales_Rep`, separated by role-gated views **and** database RLS.

Read `README.md` for setup, `supabase/README.md` for the security model and handover,
and `DESIGN.md` for the visual language. This file is the working guide for agents.

## Commands

Use Bun (the lockfile is `bun.lock`; the npm equivalents are identical).

```bash
bun install
cp .env.example .env          # then fill the Supabase values
bun run dev                   # http://localhost:3000
bun run lint
bun run build                 # lint + type errors fail the build
bun run test:rls              # 60 RLS/invariant assertions against PGlite
bun run create-admin          # bootstrap the first Admin (prompts, reads .env)
```

There is no unit/component test suite. UI changes must be verified in a running browser.
`bun run test:rls` is the regression suite for the database; run it after **any** change to
`supabase/migrations/20260915_initial_schema_and_rls.sql`.

## Environment

`.env` (never commit; only `.env.example` is tracked):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # server-only, never NEXT_PUBLIC_
```

The app runs without Supabase but shows the "not configured" gate. The demo backend
(`handover/demo-backend.mjs`, port 5599) can stand in for Supabase when recording or
browsing without real data; it is **not** part of the app and must never be deployed.

## Architecture

```
app/page.tsx                 CRM shell: tab routing, drawer, quick-add modal
app/login/page.tsx           Sign-in route (the only page reachable signed out)
app/api/admin/*/route.ts     Service-role routes: create user, reset password, delete user
app/layout.tsx               Root layout, metadata, global LegalFooter
app/terms, app/privacy       Static legal pages (content in lib/legal.ts)
components/AuthGate.tsx      Settles the session before rendering either screen
components/Navbar.tsx        Brand, role badge, account menu, logout
components/LeadDetailsDrawer.tsx   Lead record: edit, stage, notes, follow-ups, delete
components/admin/            MasterControl, TeamFollowups, FullLeadDatabase, UserManagement
components/admin/UserDetailModal.tsx  Reset password / delete account / rep chart
components/sales-rep/        TodayPriority, MyLeads, QuickAddLeadModal
lib/crmContext.tsx           ALL client state and Supabase reads/writes
lib/supabase/client.ts       Browser client (singleton, anon key, persist session)
lib/supabase/server.ts       Service-role client + requireAdmin + step-up auth
lib/types.ts                 Shared types and enums
lib/utils.ts                 Dates, phone normalization, CSV escaping, password floor
supabase/migrations/         The one migration: schema, triggers, RLS, grants, indexes
supabase/tests/              PGlite regression suite
scripts/create-admin.mjs     First-Admin bootstrap
```

Data flow: `CRMProvider` restores the session via `onAuthStateChange`, loads profile +
profiles + leads + interactions + followups in parallel, and exposes role-scoped
`visible*` arrays. Views never query Supabase directly — add operations to
`lib/crmContext.tsx` so error handling and optimistic state stay consistent.

`AuthGate require="session" | "guest"` is the only routing authority for auth.
It renders a neutral boot state until the session settles, then `router.replace`s.
Never render CRM or login content before `isLoading` is false.

## Data model

- `profiles` — mirrors `auth.users`, `role`, `is_active`. Created by the
  `on_auth_user_created` trigger.
- `leads` — client details, `assigned_rep_id` (FK RESTRICT), `status`.
- `interactions` — notes, always attributed to the author (`rep_id`).
- `followups` — `followup_date` (DATE, local calendar), `status`, `completed_at`.

Enums: `user_role`, `lead_status` (`New`, `Contacted`, `Site Visit`, `Negotiation`,
`Closed Won`, `Closed Lost`), `interaction_type`, `followup_status`.

## Security invariants — do not weaken

- Authorization is in Postgres. UI checks are mirrors, never the control.
- Roles are provisioned **only** from `app_metadata`. Never read a role from
  `user_metadata`/signup `data`: it is attacker-controlled.
- `role`, `is_active`, `email`, `id`, `created_at` are not self-writable. Column grants
  plus `guard_profiles_columns()` enforce this; do not grant broad `UPDATE` on profiles.
- Every rep RLS policy requires `is_active_user()`. Deactivation must revoke access.
- The last Admin cannot be deleted (`guard_last_admin()` + advisory lock).
- Reassignment goes through `public.reassign_lead()` so lead + pending follow-ups move
  atomically. Do not replace it with two client updates.
- `lib/supabase/server.ts` bypasses RLS. Never import it into a client component.
  Admin routes must call `requireAdmin()`; password reset and account deletion also
  verify the caller's own password (`verifyAdminPassword`).
- Do not add `FORCE ROW LEVEL SECURITY`: the `SECURITY DEFINER` helpers rely on the owner
  bypassing RLS on `profiles`, or they recurse.
- Signups stay disabled in Supabase. Accounts are provisioned from User Management.
- Keep CSP/headers in `next.config.ts` intact when adding integrations; extend
  `connect-src` rather than loosening `default-src`.

## Conventions and gotchas

- **Local dates:** use `getTodayDateStr()`/`toDateStr()`. `toISOString()` shifts the day
  in UTC+ timezones and breaks "today" follow-ups.
- **Phones:** exactly 10 digits, normalized with `normalizePhoneInput`; validate with
  `isPhoneNumber` on both client and server.
- **Writes:** surface Supabase errors; a zero-row update/delete means RLS filtered it and
  must be reported, never silently treated as success. Preserve typed form input on failure
  (lead creation can partially succeed: lead saved, note/follow-up failed).
- **Password floor:** `MIN_PASSWORD_LENGTH = 8` from `lib/utils.ts` in client and routes.
- **CSV export:** every field goes through `escapeCsvField` (formula injection), and the
  file is a Blob, not a data URI.
- **Auth errors:** one generic sign-in message; never distinguish "no such user".
- **Session hygiene:** the admin client used for step-up auth must not hold a user session;
  do not `signOut()` it (global scope would revoke the admin's sessions).
- New data state belongs in `CRMProvider`; keep `visible*` memoized role scoping.
- Admin captures: when an Admin logs the first note, `interactions.rep_id` is the Admin
  (authorship), while ownership/follow-ups go to the assigned rep.

## UI conventions

- Tailwind v4. Brand palette is applied as arbitrary values: graphite `#202020`, white
  `#ffffff`, ash `#efefef`, fog `#f5f5f5`, ivory `#ebe6dd`, steel `#4d4d4d`, slate
  `#828282`, mist `#e8e8e8`, ember `#ff682c`, brass `#816729`. Ember is an accent, not a
  button fill; primary buttons are graphite with 0–4px radius.
- Labels/metadata use `font-mono uppercase tracking-wider`; headings are light/normal
  weight; cards use `rounded-lg`. Keep the established look rather than inventing new
  patterns; see `DESIGN.md`.
- Mobile-first: test at ~390px and desktop. Tabs collapse into a hamburger menu below `md`.
- Interactive controls carry stable `id`s (`submit-login-btn`, `quick-add-name`,
  `tab-btn-*`, …). Preserve or add them: demos/e2e flows depend on them.
- Destructive actions require an explicit confirm step and, for account deletion, the
  Admin's own password.

## Verification checklist

1. `bun run lint` and `bun run build`.
2. `bun run test:rls` for schema/RLS/policy/auth changes.
3. Exercise the changed flow in the running app: sign in as each affected role, load the
   screen, perform the action, and confirm both success and denied/failure paths.
4. For UI proof, capture the actual surface; do not rely on static reasoning.
