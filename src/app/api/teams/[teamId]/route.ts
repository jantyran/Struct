import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthSession } from '@/lib/auth';
import { projectAccessForUser } from '@/lib/permissions';
import type { Team, TeamMember, Todo } from '@/types';

interface Params {
  params: Promise<{ teamId: string }>;
}

/** チーム詳細・メンバー進捗・タスク状況取得 */
export async function GET(_req: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  const { user, errorResponse } = await getAuthSession();
  if (errorResponse) return errorResponse;

  const db = getDb();
  try {
    const team = db.prepare(`
      SELECT * FROM teams WHERE id = ? AND organization_id = ?
    `).get(params.teamId, user.organization_id) as Team | undefined;

    if (!team) {
      return NextResponse.json({ error: 'チームが見つかりません' }, { status: 404 });
    }

    // メンバー一覧
    const members = db.prepare(`
      SELECT tm.id, tm.team_id, tm.user_id, tm.role, tm.created_at,
             u.name AS user_name, u.email AS user_email, u.avatar_url AS user_avatar_url
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ?
      ORDER BY CASE WHEN tm.role = 'LEADER' THEN 0 ELSE 1 END, tm.created_at ASC
    `).all(params.teamId) as TeamMember[];

    const memberUserIds = members.map((m) => m.user_id);

    // チーム関連プロジェクト一覧
    const projects = db.prepare(`
      SELECT p.*,
             (SELECT COUNT(*) FROM todos t WHERE t.project_id = p.id) AS todo_total,
             (SELECT COUNT(*) FROM todos t WHERE t.project_id = p.id AND t.status = 'done') AS todo_done
      FROM projects p
      WHERE p.organization_id = ? AND p.team_id = ? AND p.status != 'archived'
      ORDER BY p.updated_at DESC
    `).all(user.organization_id, params.teamId) as Array<Record<string, unknown>>;

    // メンバーのタスク一覧（権限制御付き）
    let allMemberTodos: Array<
      Todo & { project_name: string; project_visibility: string; assignee_name: string | null; assignee_avatar_url: string | null }
    > = [];

    if (memberUserIds.length > 0) {
      const placeholders = memberUserIds.map(() => '?').join(',');
      const candidateTodos = db.prepare(`
        SELECT t.*, p.name AS project_name, p.visibility AS project_visibility, p.id AS p_id,
               u.name AS assignee_name, u.avatar_url AS assignee_avatar_url
        FROM todos t
        JOIN projects p ON t.project_id = p.id
        LEFT JOIN users u ON t.assignee_id = u.id
        WHERE t.assignee_id IN (${placeholders}) AND p.status != 'archived'
        ORDER BY CASE WHEN t.due_date != '' THEN t.due_date ELSE '9999-99-99' END ASC, t.created_at DESC
      `).all(...memberUserIds) as Array<
        Todo & { project_name: string; project_visibility: string; p_id: string; assignee_name: string | null; assignee_avatar_url: string | null }
      >;

      // 権限フィルタ: ユーザーが閲覧できるプロジェクトのタスクのみ残す
      allMemberTodos = candidateTodos.filter((todo) => {
        const access = projectAccessForUser(db, todo.project_id, user);
        return access && access.can_view;
      });
    }

    const today = new Date().toISOString().slice(0, 10);

    // メンバーごとの進捗集計
    const memberStats = members.map((m) => {
      const userTodos = allMemberTodos.filter((t) => t.assignee_id === m.user_id);
      const total = userTodos.length;
      const done = userTodos.filter((t) => t.status === 'done').length;
      const inProgress = userTodos.filter((t) => t.status === 'in_progress').length;
      const overdue = userTodos.filter((t) => t.status !== 'done' && t.due_date && t.due_date < today).length;

      return {
        member: m,
        stats: {
          total,
          done,
          in_progress: inProgress,
          overdue,
          completion_rate: total > 0 ? Math.round((done / total) * 100) : 0,
        },
        todos: userTodos.slice(0, 15), // 各メンバー直近15件
      };
    });

    return NextResponse.json({
      team: {
        ...team,
        member_count: members.length,
        members,
      },
      projects,
      member_stats: memberStats,
      all_todos: allMemberTodos,
    });
  } catch (err) {
    console.error('GET /api/teams/[teamId] failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** チーム情報更新 */
export async function PATCH(req: Request, { params: routeParams }: Params) {
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
    user.system_permissions.manage_users ||
    user.system_role === 'SYSTEM_ADMIN' ||
    user.system_role === 'MANAGER';

  if (!isLeader && !isAdmin) {
    return NextResponse.json({ error: 'チーム編集権限がありません' }, { status: 403 });
  }

  let body: { name?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = body.name?.trim();
  const description = body.description?.trim();

  try {
    db.prepare(`
      UPDATE teams SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        updated_at = datetime('now')
      WHERE id = ? AND organization_id = ?
    `).run(name ?? null, description ?? null, params.teamId, user.organization_id);

    const updated = db.prepare('SELECT * FROM teams WHERE id = ?').get(params.teamId) as Team;
    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/teams/[teamId] failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** チーム削除 */
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
    user.system_permissions.manage_organization_settings ||
    user.system_role === 'SYSTEM_ADMIN' ||
    user.system_role === 'MANAGER';

  if (!isLeader && !isAdmin) {
    return NextResponse.json({ error: 'チーム削除権限がありません' }, { status: 403 });
  }

  try {
    db.prepare('DELETE FROM teams WHERE id = ? AND organization_id = ?').run(
      params.teamId,
      user.organization_id
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/teams/[teamId] failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
