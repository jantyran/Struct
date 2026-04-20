import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';

export async function GET(request: Request) {
  let user;
  try {
    user = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status'); // 'todo' | 'in_progress' | 'done' | null(=all)
  const priority = searchParams.get('priority');
  const projectId = searchParams.get('project_id');

  const db = getDb();

  let sql = `
    SELECT t.*, p.name AS project_name
    FROM todos t
    JOIN projects p ON t.project_id = p.id
    WHERE t.assignee_id = ?
  `;
  const args: unknown[] = [user.id];

  if (status) {
    sql += ' AND t.status = ?';
    args.push(status);
  }
  if (priority) {
    sql += ' AND t.priority = ?';
    args.push(priority);
  }
  if (projectId) {
    sql += ' AND t.project_id = ?';
    args.push(projectId);
  }

  sql += ' ORDER BY CASE WHEN t.due_date = \'\' THEN 1 ELSE 0 END ASC, t.due_date ASC, t.sort_order ASC';

  const todos = db.prepare(sql).all(...args);

  // 自分が関与するプロジェクト一覧（フィルタ用）
  const myProjects = db.prepare(`
    SELECT DISTINCT p.id, p.name FROM projects p
    LEFT JOIN project_members m ON p.id = m.project_id
    WHERE p.organization_id = ? AND (p.owner_id = ? OR m.user_id = ?)
    ORDER BY p.name ASC
  `).all(user.organization_id, user.id, user.id) as Array<{ id: string; name: string }>;

  return NextResponse.json({ todos, projects: myProjects });
}
