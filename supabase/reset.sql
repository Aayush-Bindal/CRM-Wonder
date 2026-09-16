-- ============================================================================
-- RESET — removes everything this project created, and nothing else.
--
-- For rebuilding the database on an EXISTING Supabase project: the project
-- itself, its URL, its API keys, the auth schema, its roles and the uuid-ossp
-- extension are all left untouched. Run this, then apply
-- migrations/20260915_initial_schema_and_rls.sql to rebuild from scratch.
--
-- Verified by a test that runs it against a real Postgres engine and re-applies
-- the schema afterwards (`bun run test:rls`, phase 11).
--
-- DESTRUCTIVE: every lead, interaction, follow-up and profile is deleted.
-- Nothing here is recoverable except from a backup.
--
-- Do NOT use `DROP SCHEMA public CASCADE` on Supabase. It also removes the
-- USAGE and default privileges Supabase provisioned on that schema, so you end
-- up re-granting them by hand — and it destroys any unrelated table you may have
-- put in public along the way.
-- ============================================================================

-- 1. The profile-sync trigger lives on auth.users, so it outlives the public
--    tables and would be left orphaned pointing at a dropped function.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Tables. CASCADE takes their RLS policies, their triggers, their indexes and
--    their foreign keys with them.
DROP TABLE IF EXISTS public.followups CASCADE;
DROP TABLE IF EXISTS public.interactions CASCADE;
DROP TABLE IF EXISTS public.leads CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 3. Functions. By this point nothing references them: the triggers that called
--    them went with the tables above, and the policy expressions went too.
DROP FUNCTION IF EXISTS public.reassign_lead(UUID, UUID);
DROP FUNCTION IF EXISTS public.guard_last_admin();
DROP FUNCTION IF EXISTS public.guard_profiles_columns();
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.is_active_user();
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.handle_updated_at();

-- 4. Enums. Dropping the tables does not drop these, and a rebuilt schema would
--    silently reuse the old definitions because `CREATE TYPE` is guarded on the
--    name already existing.
DROP TYPE IF EXISTS public.followup_status;
DROP TYPE IF EXISTS public.interaction_type;
DROP TYPE IF EXISTS public.lead_status;
DROP TYPE IF EXISTS public.user_role;

-- 5. OPTIONAL — also delete the existing logins.
--
--    Without this, auth.users rows survive a reset with no matching profile: the
--    sync trigger only fires on INSERT, so those accounts can sign in but land
--    in an empty shell, and no Sales Rep dashboard or admin route recognises them.
--    If this project's users are disposable, uncomment the line below and then
--    recreate the Administrator per supabase/README.md §4.
--
--    It deletes every login including your own, so take a backup first if any of
--    them matter.
--
-- DELETE FROM auth.users;

-- Left deliberately alone:
--   * the `uuid-ossp` extension and public.uuid_generate_v4()
--   * the auth schema, auth.uid(), and Supabase's anon / authenticated / service_role
--   * schema public itself, along with its USAGE grants
