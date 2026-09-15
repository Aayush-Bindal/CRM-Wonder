import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';

// POST /api/admin/delete-user
// Admin-only: permanently deletes a team member's account. Blocked when
// the target still has assigned leads/activity (leads.assigned_rep_id and
// interactions/followups.rep_id are ON DELETE RESTRICT), when the target
// is the caller's own account, or when it's the last remaining Admin.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  const userId = String(body.userId || '');
  if (!userId) {
    return NextResponse.json({ error: 'A user id is required.' }, { status: 400 });
  }

  const { supabaseAdmin, adminId } = auth;

  if (userId === adminId) {
    return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
  }

  const { data: target, error: targetError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (targetError || !target) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  if (target.role === 'Admin') {
    const { count } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'Admin');

    if ((count || 0) <= 1) {
      return NextResponse.json(
        { error: 'Cannot delete the last remaining Admin account.' },
        { status: 400 }
      );
    }
  }

  const [{ count: leadCount }, { count: interactionCount }, { count: followupCount }] = await Promise.all([
    supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_rep_id', userId),
    supabaseAdmin.from('interactions').select('id', { count: 'exact', head: true }).eq('rep_id', userId),
    supabaseAdmin.from('followups').select('id', { count: 'exact', head: true }).eq('rep_id', userId),
  ]);

  if ((leadCount || 0) > 0 || (interactionCount || 0) > 0 || (followupCount || 0) > 0) {
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
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
