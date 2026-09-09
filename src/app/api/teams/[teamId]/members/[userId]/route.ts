import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthSession } from '@/lib/auth';

interface Params {
  params: Promise<{ teamId: string; userId: string }>;
}

/** チームからメンバー除外 */
export async function DELETE(_req: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  const { user, errorResponse } = await getAuthSession();
  if (errorResponse) return errorResponse;

  const db = getDb();
  const isLeader = Boolean(
    db.prepare(`
      SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ? AND role = 'LEADER'
    `).get(params.teamId, user.id)
  );
  const isAdmin =
    user.system_permissions.manage_users ||
    user.system_role === 'SYSTEM_ADMIN' ||
    user.system_role === 'MANAGER';
  const isSelf = params.userId === user.id;

  if (!isLeader && !isAdmin && !isSelf) {
    return NextResponse.json({ error: 'メンバー除外権限がありません' }, { status: 403 });
  }

  try {
    db.prepare(`
      DELETE FROM team_members WHERE team_id = ? AND user_id = ?
    `).run(params.teamId, params.userId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/teams/[teamId]/members/[userId] failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
