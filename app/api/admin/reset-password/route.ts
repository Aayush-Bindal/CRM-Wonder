import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody, requireAdmin, UUID_PATTERN, verifyAdminPassword } from '@/lib/supabase/server';
import { MIN_PASSWORD_LENGTH } from '@/lib/utils';

// POST /api/admin/reset-password
// Admin-only, and step-up authenticated: Supabase Auth never exposes existing
// passwords (they're one-way hashed), so this is the closest legitimate
// equivalent to the demo's "view password". The caller's own password must be
// re-supplied and is verified here — a client-side prompt alone is not a
// control, since a bearer token is all an attacker with a stolen session needs.
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

  const userId = String(body.userId ?? '');
  const newPassword = String(body.newPassword ?? '');
  const adminPassword = String(body.adminPassword ?? '');

  if (!UUID_PATTERN.test(userId)) {
    return NextResponse.json({ error: 'A valid user id is required.' }, { status: 400 });
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `The new password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    );
  }

  if (!adminPassword) {
    return NextResponse.json(
      { error: 'Confirm your own password to reset another account.' },
      { status: 400 }
    );
  }

  const { supabaseAdmin, adminId, adminEmail } = auth;

  const reauthenticated = await verifyAdminPassword(adminEmail, adminPassword);
  if (!reauthenticated) {
    console.error('[admin/reset-password] step-up re-authentication failed', { adminId, userId });
    return NextResponse.json(
      { error: 'Incorrect password. The reset was not applied.' },
      { status: 401 }
    );
  }

  const { data: target, error: targetError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (targetError || !target) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) {
    console.error('[admin/reset-password] updateUserById failed', {
      adminId,
      userId,
      code: error.code,
      message: error.message,
    });
    return NextResponse.json({ error: 'Could not reset this password.' }, { status: 400 });
  }

  console.info('[admin/reset-password] password reset', { adminId, userId });

  return NextResponse.json({ success: true });
}
