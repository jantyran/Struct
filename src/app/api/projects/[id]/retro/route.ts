import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';

interface Params { params: { id: string } }

export async function GET(_req: Request, { params }: Params) {
  let user;
  try { user = await requireSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const project = db.prepare(`
    SELECT DISTINCT p.* FROM projects p
    LEFT JOIN project_members m ON p.id = m.project_id
    WHERE p.id = ? AND p.organization_id = ?
      AND (p.owner_id = ? OR m.user_id = ?)
  `).get(params.id, (db.prepare('SELECT organization_id FROM users WHERE id = ?').get(user.id) as { organization_id: string }).organization_id, user.id, user.id) as { id: string; created_at: string; completed_at?: string | null } | undefined;

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const taskSummary = db.prepare(`
    SELECT
      COUNT(*) AS total_tasks,
      COUNT(CASE WHEN status = 'done' THEN 1 END) AS completed_tasks,
      COUNT(CASE WHEN status = 'done' AND due_date != '' AND completed_at IS NOT NULL AND date(completed_at) <= date(due_date) THEN 1 END) AS on_time_tasks,
      ROUND(AVG(CASE WHEN status = 'done' AND completed_at IS NOT NULL THEN julianday(completed_at) - julianday(created_at) END), 1) AS avg_completion_days,
      MIN(CASE WHEN status = 'done' AND completed_at IS NOT NULL THEN completed_at END) AS first_completed_at,
      MAX(CASE WHEN status = 'done' AND completed_at IS NOT NULL THEN completed_at END) AS last_completed_at
    FROM todos
    WHERE project_id = ?
  `).get(params.id) as {
    total_tasks: number;
    completed_tasks: number;
    on_time_tasks: number;
    avg_completion_days: number | null;
    first_completed_at: string | null;
    last_completed_at: string | null;
  };

  const memberContributions = db.prepare(`
    SELECT u.id AS user_id, u.name, u.email,
      COUNT(CASE WHEN t.status = 'done' AND (t.assignee_id = u.id OR t.completed_by = u.id) THEN 1 END) AS completed
    FROM users u
    LEFT JOIN todos t ON t.project_id = ?
    JOIN project_members m ON m.project_id = ? AND m.user_id = u.id
    WHERE u.organization_id = (SELECT organization_id FROM projects WHERE id = ?)
    GROUP BY u.id
    HAVING completed > 0
    ORDER BY completed DESC
  `).all(params.id, params.id, params.id) as Array<{ user_id: string; name: string | null; email: string; completed: number }>;

  const ownerContrib = db.prepare(`
    SELECT u.id AS user_id, u.name, u.email,
      COUNT(CASE WHEN t.status = 'done' AND (t.assignee_id = u.id OR t.completed_by = u.id) THEN 1 END) AS completed
    FROM users u
    JOIN projects p ON p.owner_id = u.id
    LEFT JOIN todos t ON t.project_id = p.id
    WHERE p.id = ?
    GROUP BY u.id
    HAVING completed > 0
  `).all(params.id) as Array<{ user_id: string; name: string | null; email: string; completed: number }>;

  const allContribs = [...memberContributions];
  for (const oc of ownerContrib) {
    if (!allContribs.find(c => c.user_id === oc.user_id)) allContribs.push(oc);
  }
  allContribs.sort((a, b) => b.completed - a.completed);

  const monthlyCompletions = db.prepare(`
    SELECT strftime('%Y-%m', completed_at) AS month, COUNT(*) AS count
    FROM todos
    WHERE project_id = ? AND status = 'done' AND completed_at IS NOT NULL
    GROUP BY month
    ORDER BY month ASC
  `).all(params.id) as Array<{ month: string; count: number }>;

  const fastestTask = db.prepare(`
    SELECT title, ROUND(julianday(completed_at) - julianday(created_at), 1) AS completion_days
    FROM todos
    WHERE project_id = ? AND status = 'done' AND completed_at IS NOT NULL
      AND julianday(completed_at) - julianday(created_at) >= 0
    ORDER BY julianday(completed_at) - julianday(created_at) ASC
    LIMIT 1
  `).get(params.id) as { title: string; completion_days: number } | undefined;

  const durationDays = project.completed_at
    ? Math.round((new Date(project.completed_at).getTime() - new Date(project.created_at).getTime()) / 86400000)
    : null;

  return NextResponse.json({
    task_summary: taskSummary,
    member_contributions: allContribs,
    monthly_completions: monthlyCompletions,
    fastest_task: fastestTask ?? null,
    duration_days: durationDays,
    project_created_at: project.created_at,
    project_completed_at: project.completed_at ?? null,
  });
}
