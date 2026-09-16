import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody, requireAdmin } from '@/lib/supabase/server';
import { MIN_PASSWORD_LENGTH } from '@/lib/utils';

// POST /api/admin/create-user
// Admin-only: provisions a new team member via Supabase Auth. The
// on_auth_user_created trigger (see supabase/migrations) creates the
// matching public.profiles row, taking the role from app_metadata — the
// admin-only metadata field. user_metadata is attacker-controlled (it is the
// `data` object of a signup request), so the role must never travel in it.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const parsed = await readJsonBody(req);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const body = parsed.body;

  const fullName = String(body.full_name ?? '').trim();
  const email = String(body.email ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const password = String(body.password ?? '');
  const role = body.role === 'Admin' ? 'Admin' : 'Sales_Rep';

  if (!fullName || !email) {
    return NextResponse.json(
      { error: 'Full name and email are required.' },
      { status: 400 }
    );
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `The password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const { supabaseAdmin } = auth;

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: { full_name: fullName, phone: phone || null },
  });

  if (createError || !created.user) {
    // The upstream message is logged, never returned: it discloses provider
    // internals and doubles as an account-existence oracle.
    console.error('[admin/create-user] createUser failed', {
      adminId: auth.adminId,
      email,
      code: createError?.code,
      message: createError?.message,
    });
    // GoTrue reports this as error_code "email_exists"; auth-js surfaces it as
    // `code` only when it can read the API-version header, so the message is a
    // fallback for older/other deployments.
    const alreadyRegistered =
      createError?.code === 'email_exists' ||
      /already been registered|already registered/i.test(createError?.message ?? '');
    return NextResponse.json(
      {
        error: alreadyRegistered
          ? 'That email address is already registered.'
          : 'Failed to create the account.',
      },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', created.user.id)
    .single();

  if (profileError || !profile) {
    console.error('[admin/create-user] profile read failed', {
      userId: created.user.id,
      message: profileError?.message,
    });
    return NextResponse.json(
      { error: 'Account created, but the profile record could not be loaded.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, profile });
}
