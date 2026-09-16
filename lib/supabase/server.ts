import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

// Server-only client using the service role key. Never import this from
// client components — it bypasses Row Level Security entirely.
export function getSupabaseAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type JsonBodyResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string };

// Reads a JSON object body without letting a malformed request escape as a 500.
// `req.json()` throws on an invalid or empty body and resolves to `null` for a
// literal JSON `null`, so both are turned into an explicit 400.
export async function readJsonBody(req: NextRequest): Promise<JsonBodyResult> {
  try {
    const parsed: unknown = await req.json();
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'A JSON object body is required.' };
    }
    return { ok: true, body: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, error: 'The request body must be valid JSON.' };
  }
}

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RequireAdminResult =
  | { error: string; status: number }
  | { supabaseAdmin: SupabaseClient; adminId: string; adminEmail: string };

// Verifies the request's bearer token belongs to a signed-in, active Admin.
export async function requireAdmin(req: NextRequest): Promise<RequireAdminResult> {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return { error: 'Missing authorization token.', status: 401 };
  }

  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) {
    return { error: 'Supabase is not configured on the server.', status: 500 };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) {
    return { error: 'Invalid or expired session.', status: 401 };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, is_active, email')
    .eq('id', userData.user.id)
    .single();

  // is_active is the deprovisioning switch: an account with the flag cleared
  // must not be able to drive the admin API even though its JWT is still valid.
  if (profileError || !profile || profile.role !== 'Admin' || !profile.is_active) {
    return { error: 'Admin access required.', status: 403 };
  }

  return {
    supabaseAdmin,
    adminId: userData.user.id,
    adminEmail: profile.email ?? userData.user.email ?? '',
  };
}

// Server-side step-up authentication for destructive admin actions.
//
// Verifies the caller's own password against Supabase Auth using a throwaway
// client: the shared admin client must never hold a user session, because
// supabase-js prefers an in-memory session token over the configured key and
// every later admin query would silently start running under RLS.
//
// This client is deliberately NOT signed out afterwards — signOut() defaults to
// the 'global' scope and would revoke the admin's other sessions.
export async function verifyAdminPassword(email: string, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || !email || !password) return false;

  const verifier = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await verifier.auth.signInWithPassword({ email, password });
  return !error && Boolean(data.session);
}
