import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';

// POST /api/admin/reset-password
// Admin-only: sets a new password for a team member. Supabase Auth
// never exposes existing passwords (they're one-way hashed) — this is
// the closest legitimate equivalent to the demo's "view password".
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  const userId = String(body.userId || '');
  const newPassword = String(body.newPassword || '');

  if (!userId || newPassword.length < 6) {
    return NextResponse.json(
      { error: 'A user id and a password of at least 6 characters are required.' },
      { status: 400 }
    );
  }

  const { supabaseAdmin } = auth;
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
