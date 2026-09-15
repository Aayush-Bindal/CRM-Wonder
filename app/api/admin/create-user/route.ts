import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';

// POST /api/admin/create-user
// Admin-only: provisions a new team member via Supabase Auth. The
// on_auth_user_created trigger (see supabase/migrations) creates the
// matching public.profiles row from the metadata passed here.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  const fullName = String(body.full_name || '').trim();
  const email = String(body.email || '').trim();
  const phone = String(body.phone || '').trim();
  const password = String(body.password || '');
  const role = body.role === 'Admin' ? 'Admin' : 'Sales_Rep';

  if (!fullName || !email || !phone || password.length < 6) {
    return NextResponse.json(
      { error: 'Full name, email, phone, and a password of at least 6 characters are required.' },
      { status: 400 }
    );
  }

  const { supabaseAdmin } = auth;

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone, role },
  });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message || 'Failed to create the account.' },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', created.user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'Account created, but the profile record could not be loaded.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, profile });
}
