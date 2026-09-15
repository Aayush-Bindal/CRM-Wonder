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

type RequireAdminResult =
  | { error: string; status: number }
  | { supabaseAdmin: SupabaseClient; adminId: string };

// Verifies the request's bearer token belongs to a signed-in Admin.
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
    .select('role')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile || profile.role !== 'Admin') {
    return { error: 'Admin access required.', status: 403 };
  }

  return { supabaseAdmin, adminId: userData.user.id };
}
