# Supabase Deployment & Automation Guide: Minimalist Real Estate CRM

This directory contains the production PostgreSQL schema migration, Row-Level Security (RLS) policies, and Supabase Edge Functions for the **Minimalist Real Estate CRM**.

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
3. Admins can create sales rep accounts via the Admin Dashboard or via the Supabase Auth API (`auth.admin.createUser`).

---

## 4. Deploying Edge Functions

### Step 4.1: Set Environment Secrets
```bash
supabase secrets set MESSAGING_API_KEY="your-whatsapp-or-sms-api-key"
supabase secrets set MESSAGING_API_URL="https://api.messaging_provider.com/send"
```

### Step 4.2: Deploy `lead-thank-you`
```bash
supabase functions deploy lead-thank-you --no-verify-jwt
```

### Step 4.3: Deploy `daily-greetings-followups`
```bash
supabase functions deploy daily-greetings-followups --no-verify-jwt
```

---

## 5. Configuring Database Webhook for Immediate "Thank You" Trigger

To trigger the `lead-thank-you` Edge Function whenever a new lead is inserted into the `leads` table:

1. In the Supabase Dashboard, navigate to **Database** -> **Webhooks**.
2. Click **Create a new webhook**.
3. Fill in:
   - **Name**: `on_lead_created_thank_you`
   - **Table**: `public.leads`
   - **Events**: Check **Insert** only
   - **Type**: **Supabase Edge Function**
   - **Function**: Select `lead-thank-you`
   - **HTTP Method**: `POST`
4. Save the webhook.

Alternatively, create via SQL:
```sql
CREATE OR REPLACE TRIGGER "on_lead_created_thank_you"
AFTER INSERT ON "public"."leads"
FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"(
  'https://<project-ref>.supabase.co/functions/v1/lead-thank-you',
  'POST',
  '{"Content-Type":"application/json"}',
  '{}',
  '1000'
);
```

---

## 6. Configuring Scheduled Daily Greetings & Follow-ups (Cron)

Schedule the `daily-greetings-followups` function to execute every morning at **08:00 AM UTC**:

Using Supabase `pg_cron` (in SQL Editor):
```sql
-- Enable the pg_net and pg_cron extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily trigger at 08:00 UTC
SELECT cron.schedule(
  'daily-crm-greetings-and-priority',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/daily-greetings-followups',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```
