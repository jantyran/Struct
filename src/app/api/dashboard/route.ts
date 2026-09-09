import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthSession } from '@/lib/auth';
import { getOrganizationSettingsRow } from '@/lib/organization-settings';
import { normalizeProjectTypeDefinitionsRow } from '@/lib/project-types';
import type { Project } from '@/types';

interface ProjectRow extends Project {
  todo_total: number;
  todo_done: number;
}

interface DashboardTodo {
  id: string;
  project_id: string;
  project_name: string;
  title: string;
  status: string;
  priority: string;
  due_date: string;
  assignee_id: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
}

export async function GET() {
  const { user, errorResponse } = await getAuthSession();
  if (errorResponse) return errorResponse;

  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  // プロジェクト取得（権限に応じて全件 or 自分関係のみ）
  const canViewAll =
    user.system_permissions.view_all_projects ||
    user.system_permissions.edit_all_projects;

  const projects: Project[] = canViewAll
    ? (db.prepare('SELECT * FROM projects WHERE organization_id = ? ORDER BY updated_at DESC').all(user.organization_id) as Project[])
    : (db.prepare(`
        SELECT DISTINCT p.* FROM projects p
        LEFT JOIN project_members m ON p.id = m.project_id
        LEFT JOIN team_members tm ON p.team_id = tm.team_id AND tm.user_id = ?
        WHERE p.organization_id = ? AND (
          p.owner_id = ? OR
          m.user_id = ? OR
          (p.visibility = 'team' AND tm.user_id IS NOT NULL) OR
          (p.visibility = 'public' OR p.visibility IS NULL OR p.visibility = '')
        )
        ORDER BY p.updated_at DESC
      `).all(user.id, user.organization_id, user.id, user.id) as Project[]);

  // Todo 集計（プロジェクトごと）
  const projectIds = projects.map(p => p.id);
  const todoCountMap: Record<string, { total: number; done: number }> = {};

  if (projectIds.length > 0) {
    const placeholders = projectIds.map(() => '?').join(',');
    const todoCounts = db.prepare(`
      SELECT project_id,
             COUNT(*) AS total,
             SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done
      FROM todos
      WHERE project_id IN (${placeholders})
      GROUP BY project_id
    `).all(...projectIds) as Array<{ project_id: string; total: number; done: number }>;

    for (const row of todoCounts) {
      todoCountMap[row.project_id] = { total: row.total, done: row.done };
    }
  }

  const projectsWithTodos: ProjectRow[] = projects.map(p => ({
    ...p,
    todo_total: todoCountMap[p.id]?.total ?? 0,
    todo_done: todoCountMap[p.id]?.done ?? 0,
  }));

  // 自分にアサインされた未完了Todo（期日順、最大8件）
  const myOpenTodos: DashboardTodo[] = db.prepare(`
    SELECT t.id, t.project_id, p.name AS project_name,
           t.title, t.status, t.priority, t.due_date, t.assignee_id,
           NULL AS assignee_name, NULL AS assignee_email
    FROM todos t
    JOIN projects p ON t.project_id = p.id
    WHERE t.assignee_id = ?
      AND p.organization_id = ?
      AND t.status != 'done'
    ORDER BY
      CASE WHEN t.due_date = '' THEN 1 ELSE 0 END ASC,
      t.due_date ASC,
      t.sort_order ASC
    LIMIT 8
  `).all(user.id, user.organization_id) as DashboardTodo[];

  // 自分の未完了Todo数（全プロジェクト・件数のみ）
  const myOpenCount = (db.prepare(`
    SELECT COUNT(*) AS cnt FROM todos t
    JOIN projects p ON t.project_id = p.id
    WHERE t.assignee_id = ? AND p.organization_id = ? AND t.status != 'done'
  `).get(user.id, user.organization_id) as { cnt: number }).cnt;

  const ownedProjectIds = projects
    .filter(p => p.owner_id === user.id)
    .map(p => p.id);

  let managedUrgentTodos: DashboardTodo[] = [];
  if (ownedProjectIds.length > 0) {
    const placeholders = ownedProjectIds.map(() => '?').join(',');
    managedUrgentTodos = db.prepare(`
      SELECT t.id, t.project_id, p.name AS project_name,
             t.title, t.status, t.priority, t.due_date, t.assignee_id,
             u.name AS assignee_name, u.email AS assignee_email
      FROM todos t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.project_id IN (${placeholders})
        AND t.status != 'done'
        AND t.due_date != ''
        AND t.due_date <= ?
      ORDER BY t.due_date ASC
      LIMIT 10
    `).all(...ownedProjectIds, today) as DashboardTodo[];
  }

  // フェーズ定義（プロジェクトカードの進捗計算用）
  const settingsRow = getOrganizationSettingsRow(db, user.organization_id);
  const projectTypeDefinitions = normalizeProjectTypeDefinitionsRow(settingsRow);

  // 期限切れ・本日・今後7日以内に期限の自分のタスク
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const thisWeekTodos: DashboardTodo[] = db.prepare(`
    SELECT t.id, t.project_id, p.name AS project_name,
           t.title, t.status, t.priority, t.due_date, t.assignee_id,
           NULL AS assignee_name, NULL AS assignee_email
    FROM todos t
    JOIN projects p ON t.project_id = p.id
    WHERE t.assignee_id = ?
      AND p.organization_id = ?
      AND t.status != 'done'
      AND t.due_date != ''
      AND t.due_date <= ?
    ORDER BY t.due_date ASC
    LIMIT 10
  `).all(user.id, user.organization_id, weekEndStr) as DashboardTodo[];

  // 更新が14日以上止まっているアクティブプロジェクト
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - 14);
  const staleThresholdStr = staleThreshold.toISOString().slice(0, 19).replace('T', ' ');

  const staleProjects = projectsWithTodos.filter(
    p => p.status === 'active' && p.updated_at && p.updated_at < staleThresholdStr
  );

  const myUrgentCount = myOpenTodos.filter(t => t.due_date && t.due_date <= today).length;

  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    draft: projects.filter(p => p.status === 'draft').length,
    completed: projects.filter(p => p.status === 'completed').length,
    my_todo_open: myOpenCount,
    my_todo_urgent: myUrgentCount,
  };

  // オンボーディングプロジェクトの進捗
  // ユーザーが自力で完了できるプロジェクト（アサイン先が自分のタスクが存在するもの）を優先表示する
  const onboardingProjects = projectsWithTodos.filter(p => p.is_onboarding === 1);
  const userOnboarding = onboardingProjects.find(p => {
    const myTodoCount = (db.prepare(
      `SELECT COUNT(*) as cnt FROM todos WHERE project_id = ? AND assignee_id = ?`
    ).get(p.id, user.id) as { cnt: number }).cnt;
    return myTodoCount > 0;
  }) ?? onboardingProjects[0];
  const onboarding = onboardingProjects.length > 0 && userOnboarding
    ? {
        projects: onboardingProjects.map(p => ({ id: p.id, name: p.name, todo_total: p.todo_total, todo_done: p.todo_done })),
        primary_project_id: userOnboarding.id,
        total: userOnboarding.todo_total,
        done: userOnboarding.todo_done,
        all_complete: userOnboarding.todo_total > 0 && userOnboarding.todo_done >= userOnboarding.todo_total,
      }
    : null;

  return NextResponse.json({
    projects: projectsWithTodos,
    my_open_todos: myOpenTodos,
    managed_urgent_todos: managedUrgentTodos,
    this_week_todos: thisWeekTodos,
    stale_projects: staleProjects,
    project_type_definitions: projectTypeDefinitions,
    stats,
    onboarding,
  });
}
