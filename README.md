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

   The service role key is used only in server-side API routes (`app/api/admin/*`) and is never exposed to the client.

3. Apply the database schema. In the Supabase dashboard, open the SQL Editor, paste the contents of `supabase/migrations/20260915_initial_schema_and_rls.sql`, and run it. This creates the `profiles`, `leads`, `interactions`, and `followups` tables along with their Row Level Security policies. See `supabase/README.md` for details.

4. In the Supabase dashboard, go to Authentication -> Providers -> Email and make sure the Email provider is enabled. Signups should stay disabled, since accounts are provisioned by an Admin from within the app, not through self-registration.

5. Create the first Admin account using the Supabase Auth Admin API (`auth.admin.createUser`) with `user_metadata` containing `full_name` and `role: "Admin"`. A database trigger automatically creates the matching profile row. Every subsequent account can be created from the app's User Management screen once signed in as an Admin.

6. Run the app:

   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` - start the development server
- `npm run build` - build for production
- `npm run start` - run the production build
- `npm run lint` - run ESLint
- `npm run clean` - remove the `.next` build output

## Roles

- **Admin**: full visibility across all leads, interactions, and follow-ups; manages the team (create accounts, reset passwords, reassign leads); views team-wide reporting.
- **Sales Representative**: sees only leads assigned to them, logs interactions, and manages their own follow-up schedule. Enforced by Postgres Row Level Security, not just the UI.

## Project Structure

```
app/                    Next.js App Router pages and API routes
  api/admin/            Admin-only server routes (create user, reset password)
components/
  admin/                Admin dashboard views
  sales-rep/            Sales rep dashboard views
lib/
  crmContext.tsx        Client-side data layer (auth, leads, interactions, follow-ups)
  supabase/             Supabase client (browser) and admin client (server)
  types.ts              Shared TypeScript types
supabase/
  migrations/           Database schema and RLS policies
```
