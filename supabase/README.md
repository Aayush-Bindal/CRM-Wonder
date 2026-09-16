# Supabase Setup & Handover Guide

One file, one project, nothing else to apply:

```
supabase/migrations/20260915_initial_schema_and_rls.sql
```

It contains the tables, enums, indexes, helper functions, guard triggers, RLS
policies and the access-control grants. Paste it into **Supabase → SQL Editor → New
query → Run** against an empty project and the database is ready.

It is re-runnable: the `CREATE POLICY` statements are wrapped in
`DROP POLICY IF EXISTS`, and everything else is `IF NOT EXISTS` / `CREATE OR
REPLACE`.

Test it before trusting it:

```bash
bun run test:rls
```

That executes the real migration against a real Postgres engine (PGlite) in a
Supabase-shaped privilege environment — `anon` / `authenticated` / `service_role`,
`auth.uid()` from a JWT-claim GUC, plus the platform's default grants — and asserts
60 properties: escalation is refused, deactivation revokes access, the last Admin
survives, lead deletion cascades, and legitimate work still succeeds. Regressing any
of them fails the run.

---

## 1. What is enforced

| Table | Sales Rep | Admin |
|---|---|---|
| `profiles` | reads own record + the active-teammate directory; edits own `full_name` / `phone` | full access |
| `leads` | reads / creates / edits / deletes only leads assigned to them; cannot reassign one away | full access |
| `interactions` | reads and logs only on their own leads, always attributed to themselves | full access |
| `followups` | reads / creates / completes only their own | full access |

Beyond RLS, four invariants hold:

- **`role` and `is_active` cannot be changed by their owner.** Column-scoped GRANTs
  restrict the self-service profile edit to `full_name` and `phone`, and the
  `guard_profiles_columns` trigger rejects changes to `role`, `is_active`, `email`,
  `id` or `created_at` from anyone but an Admin. Without this, any Sales Rep could
  `PATCH` their own row to `role = 'Admin'` — RLS is row-level, so a policy that
  permits updating your own row permits every column of it.
- **Roles come from `app_metadata`.** `raw_user_meta_data` is the attacker-controlled
  `data` object of a signup request, so copying `role` from it would let anyone mint
  an Administrator. `raw_app_meta_data` is writable only by the service role.
- **The last remaining Admin cannot be deleted**, by any caller — a trigger, with an
  advisory lock so two concurrent deletions cannot both pass a stale count.
- **Deactivation actually revokes.** Every rep-facing policy requires an active
  profile, and the admin API routes check the same flag.

Deleting a lead removes its interactions and follow-ups too (`ON DELETE CASCADE`).
That is the point of the feature — the record was never real — but it also means
lead deletion is the destructive action to think hardest about. To restrict it to
Admins, drop the `rep_delete_own_leads` policy and revoke `DELETE` on `leads` in
section 9 of the migration. The app needs no change.

---

## 2. Starting over on an existing project

To rebuild the database without touching the Supabase project itself — same URL,
same API keys, same auth — run **`supabase/reset.sql`**, then re-run the migration.

It drops exactly what the migration created: the four tables (with their policies,
triggers and indexes), the seven functions, the four enums, and the profile-sync
trigger on `auth.users`. It deliberately leaves the `uuid-ossp` extension, the
`auth` schema, `auth.uid()`, the `anon` / `authenticated` / `service_role` roles,
and `public` itself with its USAGE grants.

Do **not** use `DROP SCHEMA public CASCADE` instead: that also removes the USAGE and
default privileges Supabase provisioned on the schema, so you end up re-granting them
by hand, and it destroys any unrelated table you have put in `public`.

The script has one optional final step, commented out: `DELETE FROM auth.users`.
Without it, existing logins survive the reset with no matching profile — the sync
trigger only fires on INSERT — so those accounts can sign in but land in an empty
shell. Uncomment it if the project's users are disposable, then recreate the
Administrator per §4.

`bun run test:rls` phase 11 runs this whole cycle: reset, assert everything is gone,
re-apply the migration, create an Admin, and confirm the rebuilt database is both
functional and still hardened.

---

## 3. Prepare the empty project

1. **Create the project**, then run the migration (§ above).
2. **Turn off signups** — Authentication → Providers → Email → *Enable Signups* OFF.
   Accounts are provisioned by an Admin; signups left on admit uninvited users.
3. **Set the password floor** — Authentication → Policies → minimum length **8**, to
   match what the app and the API routes enforce.
4. **Create the Admin account** (see §4).

---

## 4. Creating the Admin account

The role has to arrive in `app_metadata`, which the dashboard's *Add user* form
cannot set — it writes `user_metadata`. Two ways, pick either:

**A. Promote after creating (simplest — no scripting)**

1. Authentication → Users → *Add user*: email, password, **Auto Confirm User** ON.
2. Promote them in the SQL Editor:

```sql
UPDATE public.profiles SET role = 'Admin' WHERE email = 'owner@example.com';
```

**B. Create with the Admin API**

```js
await supabase.auth.admin.createUser({
  email: 'owner@example.com',
  password: '<at least 8 characters>',
  email_confirm: true,
  app_metadata: { role: 'Admin' },          // <- the role lives here
  user_metadata: { full_name: 'Owner Name' },
});
```

Both work because `auth.uid()` is NULL in those contexts, which is exactly what the
guard trigger allows through. Every later account is created from the app's
**User Management** screen with role and password, and needs neither step.

**One Admin is enough to run the business.** They provision every rep from User
Management, reset forgotten passwords, and reassign leads. Two things to know:

- A single Admin cannot be locked out by accident: deleting your own account is
  blocked, and the last-Admin guard blocks deleting the only one.
- The gap is **password recovery**. The app has no "forgot password" email flow, and
  an Admin can only reset *other* people's passwords — so an Admin who forgets theirs
  is recovered through the Supabase dashboard (Authentication → Users → reset), or by
  running migration step A again after creating a replacement. There is no in-app
  path, so keep dashboard access to the project.

A second Admin (an operations manager, or a break-glass account you keep) removes
that dependency. Not required, but it is the difference between "a five-minute
dashboard task" and "a call to you".

---

## 5. Handing over the deployment

Environment variables (Vercel/Netlify → Project → Environment Variables):

```
NEXT_PUBLIC_SUPABASE_URL       = https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = <anon public key>
SUPABASE_SERVICE_ROLE_KEY      = <service role key>     <- server-side ONLY
```

- **Never** prefix the service role key with `NEXT_PUBLIC_`. It bypasses RLS, and
  anything `NEXT_PUBLIC_` is inlined into the browser bundle. The app reads it only in
  `lib/supabase/server.ts`, used by `app/api/admin/*`.
- Never commit `.env` (it is gitignored, including `.env*` while keeping
  `.env.example`).
- Hand the client their **app URL and their Admin password**. Not the keys — unless
  they host it themselves, in which case pass the three values through a password
  manager rather than email.

Operational notes worth passing on:

- **Deactivating** a user: clear `profiles.is_active`. That stops all API access
  immediately — but an already-issued session keeps refreshing until it expires, so
  for an offboarding also ban the user in Authentication → Users. There is no
  deactivate button in the app yet; it is one SQL statement:
  `UPDATE public.profiles SET is_active = FALSE WHERE email = '...';`
- **Backups**: Supabase's daily backups are on by default; confirm the retention on
  the project's plan.
- **Renaming/deleting a rep** requires reassigning their leads first — the foreign
  keys are `ON DELETE RESTRICT`, and the app says so rather than failing obscurely.
