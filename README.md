# Wonder

Mobile-first real estate sales CRM for property brokerages. Tracks leads through a sales pipeline, schedules and manages follow-ups, and separates Admin and Sales Representative workflows with role-based access enforced at the database level.

## Tech Stack

- Next.js 15 (App Router) with React 19 and TypeScript
- Tailwind CSS v4
- Supabase (Postgres, Auth, Row Level Security)
- lucide-react for icons

## Prerequisites

- Node.js 18+
- A Supabase project

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your Supabase project credentials:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-public-key"
   SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ```

   The service role key is used only in server-side API routes (`app/api/admin/*`) and is never exposed to the client. Never prefix it with `NEXT_PUBLIC_`.

3. Apply the database schema. In the Supabase dashboard, open the SQL Editor, paste the contents of `supabase/migrations/20260915_initial_schema_and_rls.sql`, and run it. That single file creates the `profiles`, `leads`, `interactions`, and `followups` tables with their Row Level Security policies, guard triggers and access grants. See `supabase/README.md` for the security model and the handover checklist.

4. In the Supabase dashboard, go to Authentication -> Providers -> Email and make sure the Email provider is enabled. **Signups must stay disabled**: accounts are provisioned by an Admin from within the app. The schema no longer trusts signup metadata for the role, but leaving signups on still lets uninvited accounts in.

5. Create the first Admin account. Signing in never creates an account — the app has no sign-up screen, by design — so this one is created from outside it:

   ```bash
   bun run create-admin
   ```

   It prompts for email, full name and password, and reads the credentials from `.env`. The role is passed in `app_metadata`, the only metadata a user cannot write themselves. A database trigger creates the matching profile row. Every subsequent account is created from the app's User Management screen once signed in as an Admin.

   Without the script: create the user in Supabase → Authentication → Users (*Auto Confirm User* ON), then run `UPDATE public.profiles SET role = 'Admin' WHERE email = 'admin@yourcompany.com';`. See `supabase/README.md` §4 for that path and for repairing a login that has no profile.

6. Run the app:

   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` - start the development server
- `npm run build` - build for production
- `npm run start` - run the production build
- `npm run lint` - run ESLint
- `npm run test:rls` - run the Row Level Security regression tests against a real Postgres engine (PGlite), covering privilege escalation, account deactivation, role provisioning and the last-Admin guard
- `npm run clean` - remove the `.next` build output

## Roles

- **Admin**: full visibility across all leads, interactions, and follow-ups; manages the team (create accounts, reset passwords, reassign leads); edits and deletes any lead; views team-wide reporting. Resetting a password or deleting an account requires re-entering the Admin's own password, which the server verifies.
- **Sales Representative**: sees only leads assigned to them, logs interactions, manages their own follow-up schedule, and can correct or delete a lead they captured by mistake. Enforced by Postgres Row Level Security, not just the UI.

A lead captured wrongly can be corrected or removed from the drawer opened on any
lead: **Edit** changes the client's own details (name, phones, property, budget,
address, personal dates), and **Delete Lead** removes the record together with its
interactions and follow-ups (`ON DELETE CASCADE`). Both are offered to the lead's
owner and to Admins. Reassignment and pipeline status stay on their own controls —
editing never touches who owns a lead or where it sits in the pipeline.

Accounts are revoked by clearing `profiles.is_active`. Every RLS policy requires an
active profile, and `requireAdmin` checks the same flag, so deactivation stops
PostgREST access immediately; ban the GoTrue user as well
(`auth.admin.updateUserById(id, { ban_duration: '876000h' })`) to stop the account
from refreshing its session.

## Security model

- Authorization is enforced in the database. `role` and `is_active` cannot be
  changed by their owner: column-scoped grants restrict self-service profile
  edits to `full_name` and `phone`, and a guard trigger rejects changes to
  `role`, `is_active`, `email`, `id` or `created_at` from anyone but an Admin.
- The role is provisioned from `app_metadata` (server-writable only), never from
  `user_metadata` (attacker-controlled at signup).
- The last remaining Admin cannot be deleted — enforced by a trigger, not by an
  application-side count.
- Multi-step writes that must not half-apply (lead reassignment) go through a
  database function so they are atomic.
- `npm run test:rls` exercises all of the above against a real Postgres engine.

## Project Structure

```
app/                    Next.js App Router pages and API routes
  api/admin/            Admin-only server routes (create user, reset password, delete user)
components/
  admin/                Admin dashboard views
  sales-rep/            Sales rep dashboard views
lib/
  crmContext.tsx        Client-side data layer (auth, leads, interactions, follow-ups)
  supabase/             Supabase client (browser) and admin client (server)
  types.ts              Shared TypeScript types
supabase/
  migrations/           Database schema, RLS policies and security hardening
  tests/                RLS regression tests (bun run test:rls)
```
