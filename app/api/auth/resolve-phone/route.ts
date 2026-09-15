import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

// POST /api/auth/resolve-phone
// Public pre-login lookup: resolves a phone number to its account email
// so the client can complete sign-in via supabase.auth.signInWithPassword.
// Returns only the email — never any password or other profile data.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const digits = String(body.phone || '').replace(/\D/g, '');

  if (digits.length < 10) {
    return NextResponse.json({ error: 'Invalid phone number.' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase is not configured on the server.' }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin.from('profiles').select('email, phone');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const last10 = digits.slice(-10);
  const match = (data || []).find(
    (p) => (p.phone || '').replace(/\D/g, '').slice(-10) === last10
  );

  if (!match) {
    return NextResponse.json({ error: 'No account found for this phone number.' }, { status: 404 });
  }

  return NextResponse.json({ email: match.email });
}
