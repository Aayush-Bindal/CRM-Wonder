-- ============================================================================
-- MINIMALIST REAL ESTATE SALES CRM - DATABASE SCHEMA & RLS POLICIES
-- Target: Supabase PostgreSQL
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CUSTOM TYPES / ENUMS
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
-- 4. PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_leads_assigned_rep ON public.leads(assigned_rep_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_dob ON public.leads(EXTRACT(MONTH FROM dob), EXTRACT(DAY FROM dob));
CREATE INDEX IF NOT EXISTS idx_leads_anniv ON public.leads(EXTRACT(MONTH FROM marriage_anniversary), EXTRACT(DAY FROM marriage_anniversary));

CREATE INDEX IF NOT EXISTS idx_interactions_lead ON public.interactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_interactions_rep ON public.interactions(rep_id);
CREATE INDEX IF NOT EXISTS idx_interactions_created ON public.interactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_followups_rep_date ON public.followups(rep_id, followup_date, status);
CREATE INDEX IF NOT EXISTS idx_followups_date ON public.followups(followup_date);
CREATE INDEX IF NOT EXISTS idx_followups_lead ON public.followups(lead_id);

-- ============================================================================
-- 5. AUTOMATIC TIMESTAMP TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_leads_updated_at ON public.leads;
CREATE TRIGGER set_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 6. AUTH PROFILE SYNC TRIGGER (Creates a profile when admin provisions a user)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role, phone)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Sales Representative'),
        NEW.email,
        COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'Sales_Rep'::public.user_role),
        NEW.raw_user_meta_data->>'phone'
    )
    ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        role = EXCLUDED.role;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 7. ROW-LEVEL SECURITY (RLS)
-- ============================================================================

-- Security Definer Helper to prevent infinite recursion on profiles table
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    current_role public.user_role;
BEGIN
    SELECT role INTO current_role
    FROM public.profiles
    WHERE id = auth.uid();
    
    RETURN (current_role = 'Admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ENABLE RLS ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- PROFILES POLICIES
-- ----------------------------------------------------------------------------
-- Admin: Full CRUD
CREATE POLICY "admin_full_access_profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Sales Rep: Can view own profile and directory of active teammates
CREATE POLICY "rep_view_profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    auth.uid() = id OR 
    (is_active = TRUE AND public.is_admin() IS FALSE)
);

-- Sales Rep: Can update own profile details (excluding role)
CREATE POLICY "rep_update_own_profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- LEADS POLICIES
-- Sales Rep: Reps must ONLY be able to view, create, or update leads that are
-- specifically assigned to their user_id. Zero access to other reps' leads.
-- Admin: Full CRUD across all data.
-- ----------------------------------------------------------------------------
-- Admin: Full CRUD on leads
CREATE POLICY "admin_all_leads"
ON public.leads
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Sales Rep: SELECT only assigned leads
CREATE POLICY "rep_select_own_leads"
ON public.leads
FOR SELECT
TO authenticated
USING (
    assigned_rep_id = auth.uid()
);

-- Sales Rep: INSERT leads assigned to oneself
CREATE POLICY "rep_insert_own_leads"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (
    assigned_rep_id = auth.uid()
);

-- Sales Rep: UPDATE only assigned leads
CREATE POLICY "rep_update_own_leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (assigned_rep_id = auth.uid())
WITH CHECK (assigned_rep_id = auth.uid());

-- Note: Reps cannot DELETE leads. Lead deletion is reserved for Admins.

-- ----------------------------------------------------------------------------
-- INTERACTIONS POLICIES
-- Sales Rep: Only log and view interactions for leads assigned to their user_id.
-- Admin: Full CRUD.
-- ----------------------------------------------------------------------------
-- Admin: Full CRUD on interactions
CREATE POLICY "admin_all_interactions"
ON public.interactions
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Sales Rep: SELECT interactions for assigned leads
CREATE POLICY "rep_select_own_interactions"
ON public.interactions
FOR SELECT
TO authenticated
USING (
    rep_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.leads
        WHERE leads.id = interactions.lead_id
        AND leads.assigned_rep_id = auth.uid()
    )
);

-- Sales Rep: INSERT interaction only for assigned lead & as self
CREATE POLICY "rep_insert_own_interactions"
ON public.interactions
FOR INSERT
TO authenticated
WITH CHECK (
    rep_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.leads
        WHERE leads.id = interactions.lead_id
        AND leads.assigned_rep_id = auth.uid()
    )
);

-- ----------------------------------------------------------------------------
-- FOLLOWUPS POLICIES
-- Sales Rep: Only view, create, or update followups assigned to their user_id.
-- Admin: Full CRUD.
-- ----------------------------------------------------------------------------
-- Admin: Full CRUD on followups
CREATE POLICY "admin_all_followups"
ON public.followups
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Sales Rep: SELECT followups assigned to self
CREATE POLICY "rep_select_own_followups"
ON public.followups
FOR SELECT
TO authenticated
USING (
    rep_id = auth.uid()
);

-- Sales Rep: INSERT followups assigned to self
CREATE POLICY "rep_insert_own_followups"
ON public.followups
FOR INSERT
TO authenticated
WITH CHECK (
    rep_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.leads
        WHERE leads.id = followups.lead_id
        AND leads.assigned_rep_id = auth.uid()
    )
);

-- Sales Rep: UPDATE followups assigned to self (e.g. marking completed, rescheduling)
CREATE POLICY "rep_update_own_followups"
ON public.followups
FOR UPDATE
TO authenticated
USING (rep_id = auth.uid())
WITH CHECK (rep_id = auth.uid());
