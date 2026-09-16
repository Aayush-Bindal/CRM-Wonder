-- ============================================================================
-- WONDER CRM — COMPLETE DATABASE SCHEMA, ROW LEVEL SECURITY AND ACCESS CONTROL
--
-- This is the only migration. Paste it into the Supabase SQL Editor (or run
-- `supabase db push`) against an empty project and the database is ready; there
-- is nothing else to apply and nothing to run afterwards.
--
-- Read the section comments before changing anything here. Several choices look
-- unusual and are load-bearing:
--
--   * Role and account status must stay unwritable by their owner — enforced by
--     column-scoped GRANTs (section 8) and the guard trigger (section 5).
--   * The role is provisioned from app_metadata only (section 6). user_metadata
--     is the attacker-controlled `data` object of a signup request.
--   * The last remaining Admin cannot be deleted (section 5).
--   * Do NOT add FORCE ROW LEVEL SECURITY to these tables — see the closing note.
--   * Do NOT name a PL/pgSQL variable after an SQL keyword — see section 4.
--
-- The file is idempotent apart from the CREATE POLICY statements, which are
-- guarded by DROP POLICY IF EXISTS so it can be re-applied safely.
-- ============================================================================


-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================================
-- 2. CUSTOM TYPES / ENUMS
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('Admin', 'Sales_Rep');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE lead_status AS ENUM (
        'New',
        'Contacted',
        'Site Visit',
        'Negotiation',
        'Closed Won',
        'Closed Lost'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE interaction_type AS ENUM (
        'Phone Call',
        'Site Visit',
        'WhatsApp',
        'In-Person Meeting',
        'Email'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE followup_status AS ENUM ('Pending', 'Completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- ============================================================================
-- 3. TABLES
-- ============================================================================

-- PROFILES (Connects directly to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role user_role NOT NULL DEFAULT 'Sales_Rep',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- LEADS TABLE
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    phone_1 TEXT NOT NULL,
    mobile_2 TEXT,
    dob DATE,
    marriage_anniversary DATE,
    preferred_property TEXT NOT NULL,
    budget TEXT,
    assigned_rep_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    status lead_status NOT NULL DEFAULT 'New',
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- INTERACTIONS TABLE (Logs conversation notes, attending rep, timestamps)
CREATE TABLE IF NOT EXISTS public.interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    rep_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    notes TEXT NOT NULL,
    interaction_type interaction_type NOT NULL DEFAULT 'Phone Call',
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- FOLLOWUPS TABLE (Stores scheduled followup_date, status, connects Lead and Rep)
CREATE TABLE IF NOT EXISTS public.followups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    rep_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    followup_date DATE NOT NULL,
    status followup_status NOT NULL DEFAULT 'Pending',
    notes TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);


-- ============================================================================
-- 4. HELPER FUNCTIONS
--
-- Every function below runs as its owner (SECURITY DEFINER) so it can read
-- public.profiles without re-entering that table's RLS policies. Two rules
-- apply to all of them:
--
--   * `SET search_path = ''` pins name resolution. Without it, a caller who can
--     CREATE in an earlier schema on the path could shadow a relation, operator
--     or function the body depends on — inside a function that runs with the
--     owner's privileges. pg_catalog is always searched implicitly, so built-ins
--     keep working. Every identifier in these bodies is schema-qualified.
--
--   * Do NOT name a PL/pgSQL variable after an SQL keyword. `current_role`,
--     `current_user`, `session_user`, `user`, `current_date` and friends are
--     parsed as SQL value expressions, which PL/pgSQL cannot shadow: a variable
--     called `current_role` compares the *keyword* (the function owner, inside a
--     SECURITY DEFINER function), not the value you assigned. Always prefix
--     variables, e.g. `v_role`.
-- ============================================================================

-- Timestamp maintenance for the *_updated_at columns.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- Is the caller a signed-in, ACTIVE Administrator?
-- Used by every admin_* policy; returns a strict boolean so a missing profile
-- (or a cleared is_active) can never be mistaken for "unknown/true".
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    v_role public.user_role;
BEGIN
    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = auth.uid() AND is_active;

    RETURN coalesce(v_role = 'Admin', FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';

-- Is the caller's own account active? Every Sales Rep policy requires it, so
-- clearing profiles.is_active revokes access immediately (see section 9 for the
-- one thing RLS cannot do on its own).
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_active
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';


-- ============================================================================
-- 5. GUARD TRIGGERS
-- ============================================================================

-- RLS is row-level: a policy that permits UPDATE on your own row permits every
-- column of it. This trigger is what stops the row's owner from promoting
-- themselves to Admin, clearing their own deactivation, or rewriting the email
-- field the admin console displays.
--
-- auth.uid() IS NULL means no end-user JWT: service_role (app/api/admin/*), the
-- SQL editor, and this migration itself. Those contexts are already trusted with
-- the whole row — notably handle_new_user() below, which inserts a freshly
-- provisioned profile while running as the table owner.
CREATE OR REPLACE FUNCTION public.guard_profiles_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.uid() IS NULL OR public.is_admin() THEN
        RETURN NEW;
    END IF;

    IF NEW.role        IS DISTINCT FROM OLD.role
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.email     IS DISTINCT FROM OLD.email
       OR NEW.id        IS DISTINCT FROM OLD.id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION
            'Only an administrator may change role, is_active, email, id or created_at on a profile.'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Deleting the last Admin leaves a tenant nobody can administer: create-user,
-- reset-password and delete-user all require an Admin, so recovery would need
-- dashboard access. The advisory transaction lock is what makes the count
-- reliable — without it two concurrent deletions can both observe a count of 2
-- and both proceed (app/api/admin/delete-user/route.ts checks the same thing,
-- but a check-then-act in application code cannot hold the invariant).
--
-- Note: a single statement that would remove every Admin, such as
-- DELETE FROM public.profiles WHERE role = 'Admin', is rejected as a whole while
-- only one Admin exists. Insert the replacement Admin first.
CREATE OR REPLACE FUNCTION public.guard_last_admin()
RETURNS TRIGGER AS $$
DECLARE
    v_remaining INTEGER;
BEGIN
    IF OLD.role <> 'Admin' THEN
        RETURN OLD;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('public.profiles.last_admin'));

    SELECT count(*) INTO v_remaining FROM public.profiles WHERE role = 'Admin';

    IF v_remaining <= 1 THEN
        RAISE EXCEPTION 'Cannot delete the last remaining Admin account.'
            USING ERRCODE = '23514';
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_leads_updated_at ON public.leads;
CREATE TRIGGER set_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS guard_profiles_columns ON public.profiles;
CREATE TRIGGER guard_profiles_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profiles_columns();

DROP TRIGGER IF EXISTS guard_last_admin ON public.profiles;
CREATE TRIGGER guard_last_admin
BEFORE DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_last_admin();


-- ============================================================================
-- 6. AUTH PROFILE SYNC TRIGGER
--
-- Creates the matching public.profiles row when an account is provisioned.
--
-- The role comes from raw_app_meta_data, which only the service role (the admin
-- API) can write. raw_user_meta_data is the `data` object of a GoTrue signup or
-- updateUser request and is fully attacker-controlled, so `role: "Admin"` in it
-- would mint an Administrator. The CASE is an explicit allow-list: anything
-- other than the literal 'Admin' — including a value that is not a valid
-- user_role — falls back to Sales_Rep instead of raising, so a malformed token
-- cannot break account provisioning.
--
-- ON CONFLICT DO NOTHING keeps this idempotent and makes it impossible for
-- metadata to overwrite an existing profile's role.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role, phone)
    VALUES (
        NEW.id,
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), 'Sales Representative'),
        NEW.email,
        CASE NEW.raw_app_meta_data->>'role'
            WHEN 'Admin' THEN 'Admin'::public.user_role
            ELSE 'Sales_Rep'::public.user_role
        END,
        NULLIF(NEW.raw_user_meta_data->>'phone', '')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- 7. RPC — ATOMIC LEAD REASSIGNMENT
--
-- Reassigning a lead means moving the lead AND its pending follow-ups. Written
-- as two client-side statements that is not atomic, and a failure between them
-- leaves follow-ups owned by the previous rep: invisible to the new owner
-- (rep_select_own_followups keys on rep_id) and still actionable by the old one.
--
-- SECURITY INVOKER, so RLS remains the authority and an explicit is_admin()
-- check adds the role gate. Never make this SECURITY DEFINER without also
-- re-validating the caller — the row-level policies are what scope it.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reassign_lead(p_lead_id UUID, p_new_rep_id UUID)
RETURNS VOID AS $$
DECLARE
    v_affected INTEGER;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only an administrator may reassign leads.'
            USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_new_rep_id AND is_active
    ) THEN
        RAISE EXCEPTION 'The target representative was not found or is deactivated.'
            USING ERRCODE = '23503';
    END IF;

    UPDATE public.leads
    SET assigned_rep_id = p_new_rep_id
    WHERE id = p_lead_id;

    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected = 0 THEN
        RAISE EXCEPTION 'Lead not found.' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.followups
    SET rep_id = p_new_rep_id
    WHERE lead_id = p_lead_id AND status = 'Pending';
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';


-- ============================================================================
-- 8. ROW LEVEL SECURITY
--
-- Model:
--   Admin               full read/write on every table.
--   Sales Rep           only their own leads, and the interactions and
--                       follow-ups attached to those leads. Cannot reassign a
--                       lead away from themselves.
--   Deactivated account may read its own profile row and nothing else — so the
--                       app can tell the user why they are locked out.
--   anon                nothing: no policy grants it anything.
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- PROFILES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "admin_full_access_profiles" ON public.profiles;
CREATE POLICY "admin_full_access_profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Own record, plus the directory of active teammates the UI needs for
-- assignment dropdowns and the advisor name on a lead. Only active accounts are
-- visible; a deactivated row is not listed.
DROP POLICY IF EXISTS "rep_view_profiles" ON public.profiles;
CREATE POLICY "rep_view_profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    auth.uid() = id OR
    (is_active = TRUE AND public.is_active_user())
);

-- Self-service edit of the harmless columns only. role / is_active / email are
-- blocked by the column grants below and by guard_profiles_columns().
DROP POLICY IF EXISTS "rep_update_own_profile" ON public.profiles;
CREATE POLICY "rep_update_own_profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id AND public.is_active_user())
WITH CHECK (auth.uid() = id AND public.is_active_user());

-- ----------------------------------------------------------------------------
-- LEADS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "admin_all_leads" ON public.leads;
CREATE POLICY "admin_all_leads"
ON public.leads
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "rep_select_own_leads" ON public.leads;
CREATE POLICY "rep_select_own_leads"
ON public.leads
FOR SELECT
TO authenticated
USING (public.is_active_user() AND assigned_rep_id = auth.uid());

DROP POLICY IF EXISTS "rep_insert_own_leads" ON public.leads;
CREATE POLICY "rep_insert_own_leads"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (public.is_active_user() AND assigned_rep_id = auth.uid());

-- WITH CHECK pins assigned_rep_id, so a rep cannot hand a lead to someone else.
DROP POLICY IF EXISTS "rep_update_own_leads" ON public.leads;
CREATE POLICY "rep_update_own_leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (public.is_active_user() AND assigned_rep_id = auth.uid())
WITH CHECK (public.is_active_user() AND assigned_rep_id = auth.uid());

-- Remove a lead captured by mistake. ON DELETE CASCADE takes its interactions
-- and follow-ups with it — which is the point: the record was never real.
-- Deleting a lead is therefore also how a bad note or a duplicate follow-up
-- disappears.
--
-- To make deletion Admin-only, drop this policy and revoke the DELETE grant in
-- section 9. The app needs no change: the button reports that the lead could not
-- be deleted.
DROP POLICY IF EXISTS "rep_delete_own_leads" ON public.leads;
CREATE POLICY "rep_delete_own_leads"
ON public.leads
FOR DELETE
TO authenticated
USING (public.is_active_user() AND assigned_rep_id = auth.uid());

-- ----------------------------------------------------------------------------
-- INTERACTIONS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "admin_all_interactions" ON public.interactions;
CREATE POLICY "admin_all_interactions"
ON public.interactions
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "rep_select_own_interactions" ON public.interactions;
CREATE POLICY "rep_select_own_interactions"
ON public.interactions
FOR SELECT
TO authenticated
USING (
    public.is_active_user() AND (
        rep_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.leads
            WHERE leads.id = interactions.lead_id
            AND leads.assigned_rep_id = auth.uid()
        )
    )
);

-- rep_id = auth.uid() keeps authorship honest: a note is always attributed to
-- the person who wrote it, never to the lead's assignee.
DROP POLICY IF EXISTS "rep_insert_own_interactions" ON public.interactions;
CREATE POLICY "rep_insert_own_interactions"
ON public.interactions
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_active_user() AND
    rep_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.leads
        WHERE leads.id = interactions.lead_id
        AND leads.assigned_rep_id = auth.uid()
    )
);

-- ----------------------------------------------------------------------------
-- FOLLOWUPS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "admin_all_followups" ON public.followups;
CREATE POLICY "admin_all_followups"
ON public.followups
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "rep_select_own_followups" ON public.followups;
CREATE POLICY "rep_select_own_followups"
ON public.followups
FOR SELECT
TO authenticated
USING (public.is_active_user() AND rep_id = auth.uid());

DROP POLICY IF EXISTS "rep_insert_own_followups" ON public.followups;
CREATE POLICY "rep_insert_own_followups"
ON public.followups
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_active_user() AND
    rep_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.leads
        WHERE leads.id = followups.lead_id
        AND leads.assigned_rep_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "rep_update_own_followups" ON public.followups;
CREATE POLICY "rep_update_own_followups"
ON public.followups
FOR UPDATE
TO authenticated
USING (public.is_active_user() AND rep_id = auth.uid())
WITH CHECK (public.is_active_user() AND rep_id = auth.uid());


-- ============================================================================
-- 9. PRIVILEGES
--
-- RLS decides which ROWS a role may touch; GRANTs decide which COLUMNS and
-- OPERATIONS it may use. Both are required, and the column list here is the
-- second half of the protection in section 5.
--
-- Everything is stated explicitly rather than relying on whatever default
-- privileges a project happens to have inherited.
-- ============================================================================
GRANT USAGE ON SCHEMA public TO authenticated, service_role;

-- The server-side admin routes (app/api/admin/*) use the service role key and
-- need unrestricted access; they bypass RLS by design.
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- No client path reads profiles through anon, and no policy grants it anything.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

GRANT SELECT ON public.profiles, public.leads, public.interactions, public.followups
    TO authenticated;

-- profiles: the client never writes this table — provisioning, password resets
-- and deletion all go through service_role. The grant exists for a future
-- self-service name/phone edit.
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM authenticated;
GRANT  UPDATE (full_name, phone) ON public.profiles TO authenticated;

REVOKE UPDATE, DELETE ON public.leads FROM authenticated;
GRANT  UPDATE (name, phone_1, mobile_2, address, dob, marriage_anniversary,
               preferred_property, budget, assigned_rep_id, status)
       ON public.leads TO authenticated;
GRANT  DELETE ON public.leads TO authenticated;

REVOKE UPDATE, DELETE ON public.interactions FROM authenticated;
GRANT  UPDATE (notes, interaction_type) ON public.interactions TO authenticated;

REVOKE UPDATE, DELETE ON public.followups FROM authenticated;
GRANT  UPDATE (followup_date, status, notes, completed_at, rep_id)
       ON public.followups TO authenticated;

-- Helper functions execute with the caller's privileges when RLS evaluates a
-- policy expression, so `authenticated` needs EXECUTE on the two predicates the
-- policies call. Everything else is closed to the API surface (PostgreSQL
-- grants EXECUTE to PUBLIC on new functions by default, and PostgREST exposes
-- every function in public as /rpc/<name>).
REVOKE ALL ON FUNCTION public.handle_updated_at()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user()        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_profiles_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_last_admin()       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin()               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_active_user()         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reassign_lead(UUID, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_admin()               TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_user()         TO authenticated;
GRANT EXECUTE ON FUNCTION public.reassign_lead(UUID, UUID) TO authenticated;


-- ============================================================================
-- 10. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_leads_assigned_rep ON public.leads(assigned_rep_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_dob ON public.leads(EXTRACT(MONTH FROM dob), EXTRACT(DAY FROM dob));
CREATE INDEX IF NOT EXISTS idx_leads_anniv ON public.leads(EXTRACT(MONTH FROM marriage_anniversary), EXTRACT(DAY FROM marriage_anniversary));

CREATE INDEX IF NOT EXISTS idx_interactions_lead ON public.interactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_interactions_rep ON public.interactions(rep_id);
CREATE INDEX IF NOT EXISTS idx_interactions_created ON public.interactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_followups_rep_date ON public.followups(rep_id, followup_date, status);
CREATE INDEX IF NOT EXISTS idx_followups_date ON public.followups(followup_date);
CREATE INDEX IF NOT EXISTS idx_followups_lead ON public.followups(lead_id);

CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON public.profiles(full_name);

-- The DOB / anniversary indexes above are only usable by a predicate that spells
-- the expression the same way, e.g.
--   WHERE EXTRACT(MONTH FROM dob) = 9 AND EXTRACT(DAY FROM dob) = 16
-- Nothing in the app queries them yet; they exist for the birthday/anniversary
-- reminders the lead form collects the dates for.


-- ============================================================================
-- OPERATIONAL NOTES
--
-- 1. Do NOT add FORCE ROW LEVEL SECURITY to these tables. is_admin() and
--    is_active_user() are SECURITY DEFINER and rely on the owner bypassing RLS
--    when they read public.profiles. Forcing RLS re-enters the profiles SELECT
--    policies from inside those functions and recurses until the statement
--    fails.
--
-- 2. RLS cannot revoke an already-issued JWT. Clearing profiles.is_active stops
--    all PostgREST access immediately (every policy tests is_active_user()) and
--    stops the admin API routes (requireAdmin checks the same flag), but the
--    account's existing session keeps refreshing until it expires. To revoke
--    completely, ban the user as well:
--
--      await supabase.auth.admin.updateUserById(id, { ban_duration: '876000h' })
--
-- 3. Provisioning the first Administrator. The role must arrive in
--    app_metadata, which the dashboard's "Add user" form cannot set (it writes
--    user_metadata). Either create the account with the Admin API:
--
--      await supabase.auth.admin.createUser({
--        email, password, email_confirm: true,
--        app_metadata: { role: 'Admin' },
--        user_metadata: { full_name: 'Owner Name' },
--      })
--
--    or create it in the dashboard and promote it with one statement:
--
--      UPDATE public.profiles SET role = 'Admin' WHERE email = 'owner@example.com';
--
--    Both work because auth.uid() is NULL in those contexts, which is exactly
--    what guard_profiles_columns() allows through.
--
-- 4. Keep "Enable Signups" OFF (Authentication -> Providers -> Email). Accounts
--    are provisioned by an Admin; the trigger no longer trusts signup metadata
--    for the role, but signups left on still admit uninvited accounts.
-- ============================================================================
