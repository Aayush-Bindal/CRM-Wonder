# Supabase Deployment Guide: Minimalist Real Estate CRM

This directory contains the production PostgreSQL schema migration and Row-Level Security (RLS) policies for the **Minimalist Real Estate CRM**.

---

## 1. Quick Setup via Supabase CLI

### Prerequisites
- Install the Supabase CLI:
  ```bash
  npm install -g supabase
  # or on macOS: brew install supabase/tap/supabase
  ```
- Login to Supabase:
  ```bash
  supabase login
  ```
- Link your Supabase project:
  ```bash
  supabase link --project-ref your-project-id
  ```

---

## 2. Apply Database Schema & Row-Level Security (RLS)

Run the migration script directly using the CLI:
```bash
supabase db push
# or manually in Supabase Dashboard -> SQL Editor:
# Copy and execute: supabase/migrations/20260915_initial_schema_and_rls.sql
```

### Verified RLS Policies:
- **`profiles`**: Reps can only view their own record and teammate directory. Admins have full access.
- **`leads`**: Sales Reps can strictly only view, create, and update leads where `assigned_rep_id = auth.uid()`. Admins have full CRUD.
- **`interactions`**: Sales Reps can only query and log interactions for leads assigned to them.
- **`followups`**: Sales Reps can only view, create, and complete follow-ups assigned to their `rep_id = auth.uid()`.

---

## 3. Disable Public Self-Registration

Per the CRM requirement, sales reps do not register themselves; the Admin provisions their accounts.

In the **Supabase Dashboard**:
1. Go to **Authentication** -> **Providers** -> **Email**.
2. **Turn OFF** "Enable Signups" (or "Allow new users to sign up").
3. Admins create sales rep accounts via the Admin Dashboard (User Management), which calls `auth.admin.createUser` server-side.
