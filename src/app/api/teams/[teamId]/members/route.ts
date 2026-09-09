import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthSession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

interface Params {
  params: Promise<{ teamId: string }>;
}

/** チームメンバー追加 / ロール更新 */
export async function POST(req: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  const { user, errorResponse } = await getAuthSession();
  if (errorResponse) return errorResponse;

  const db = getDb();
  // チームのリーダーまたは組織管理者
  const isLeader = Boolean(
    db.prepare(`
      SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ? AND role = 'LEADER'
    `).get(params.teamId, user.id)
  );
  const isAdmin =
    user.system_permissions.manage_teams ||
    user.system_permissions.manage_users ||
    user.system_permissions.manage_organization_settings ||
    user.system_role === 'SYSTEM_ADMIN' ||
    user.system_role === 'MANAGER';

  if (!isLeader && !isAdmin) {
    return NextResponse.json({ error: 'メンバー管理権限がありません' }, { status: 403 });
  }

  let body: { user_id?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const targetUserId = (body.user_id ?? '').trim();
  const role = body.role === 'LEADER' ? 'LEADER' : 'MEMBER';

  if (!targetUserId) {
    return NextResponse.json({ error: 'ユーザーIDは必須です' }, { status: 400 });
  }

  try {
    const existing = db.prepare(`
      SELECT id FROM team_members WHERE team_id = ? AND user_id = ?
    `).get(params.teamId, targetUserId) as { id: string } | undefined;

    if (existing) {
      db.prepare(`
        UPDATE team_members SET role = ? WHERE id = ?
      `).run(role, existing.id);
    } else {
      const id = uuidv4();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO team_members (id, team_id, user_id, role, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, params.teamId, targetUserId, role, now);
    }

    return NextResponse.json({ success: true, role });
  } catch (err) {
    console.error('POST /api/teams/[teamId]/members failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
