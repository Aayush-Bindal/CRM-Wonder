import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody, requireAdmin, UUID_PATTERN, verifyAdminPassword } from '@/lib/supabase/server';

// POST /api/admin/delete-user
// Admin-only, and step-up authenticated: permanently deletes a team member's
// account. Blocked when the target still has assigned leads/activity
// (leads.assigned_rep_id and interactions/followups.rep_id are ON DELETE
// RESTRICT), when the target is the caller's own account, or when it's the last
// remaining Admin — that last invariant is enforced by the guard_last_admin
// trigger, so two concurrent deletions cannot both pass a stale count.
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
  const adminPassword = String(body.adminPassword ?? '');

  if (!UUID_PATTERN.test(userId)) {
    return NextResponse.json({ error: 'A valid user id is required.' }, { status: 400 });
  }

  if (!adminPassword) {
    return NextResponse.json(
      { error: 'Confirm your own password to delete an account.' },
      { status: 400 }
    );
  }

  const { supabaseAdmin, adminId, adminEmail } = auth;

  if (userId === adminId) {
    return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
  }

  const reauthenticated = await verifyAdminPassword(adminEmail, adminPassword);
  if (!reauthenticated) {
    console.error('[admin/delete-user] step-up re-authentication failed', { adminId, userId });
    return NextResponse.json(
      { error: 'Incorrect password. The account was not deleted.' },
      { status: 401 }
    );
  }

  const { data: target, error: targetError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (targetError || !target) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  // Counts are the friendly, up-front explanation. The FK RESTRICT below and the
  // guard_last_admin trigger are the authoritative guards.
  const [leads, interactions, followups] = await Promise.all([
    supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_rep_id', userId),
    supabaseAdmin.from('interactions').select('id', { count: 'exact', head: true }).eq('rep_id', userId),
    supabaseAdmin.from('followups').select('id', { count: 'exact', head: true }).eq('rep_id', userId),
  ]);

  const countFailure = leads.error ?? interactions.error ?? followups.error;
  if (countFailure) {
    // A failed count must not be read as "no activity" — that would turn this
    // guard into a no-op and rely entirely on the foreign keys.
    console.error('[admin/delete-user] activity pre-check failed', {
      adminId,
      userId,
      message: countFailure.message,
    });
    return NextResponse.json(
      { error: 'Could not verify this user\u2019s activity. Please try again.' },
      { status: 500 }
    );
  }

  if ((leads.count || 0) > 0 || (interactions.count || 0) > 0 || (followups.count || 0) > 0) {
    return NextResponse.json(
      {
        error:
          'This user still has assigned leads or logged activity. Reassign their leads to another representative before deleting.',
      },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    console.error('[admin/delete-user] deleteUser failed', {
      adminId,
      userId,
      code: error.code,
      message: error.message,
    });
    const lastAdmin = /last remaining Admin/i.test(error.message ?? '');
    const foreignKey = /restrict|foreign key|database error deleting user/i.test(error.message ?? '');
    return NextResponse.json(
      {
        error: lastAdmin
          ? 'Cannot delete the last remaining Admin account.'
          : foreignKey
            ? 'This user still has assigned leads or logged activity. Reassign their leads to another representative before deleting.'
            : 'Could not delete this account.',
      },
      { status: 400 }
    );
  }

  console.info('[admin/delete-user] account deleted', { adminId, userId });

  return NextResponse.json({ success: true });
}
