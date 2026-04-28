import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';

type RangeKey = '30' | '90' | '180' | '365' | 'all';

function rangeStart(range: RangeKey) {
  if (range === 'all') return null;
  const date = new Date();
  date.setDate(date.getDate() - Number(range));
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  let user;
  try {
    user = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const range = (searchParams.get('range') ?? '180') as RangeKey;
  const start = rangeStart(['30', '90', '180', '365', 'all'].includes(range) ? range : '180');
  const db = getDb();
  const dateFilter = start ? 'AND date(COALESCE(t.completed_at, t.created_at)) >= date(?)' : '';
  const dateArgs = start ? [start] : [];

  const taskSummary = db.prepare(`
    SELECT
      COUNT(CASE WHEN t.assignee_id = ? THEN 1 END) AS assigned_total,
      COUNT(CASE WHEN t.assignee_id = ? AND t.status != 'done' THEN 1 END) AS assigned_open,
      COUNT(CASE WHEN t.assignee_id = ? AND t.status = 'done' THEN 1 END) AS assigned_completed,
      COUNT(CASE WHEN t.assignee_id = ? AND t.status != 'done' AND t.due_date != '' AND date(t.due_date) < date('now') THEN 1 END) AS assigned_overdue,
      COUNT(CASE WHEN t.completed_by = ? THEN 1 END) AS completed_by_me,
      COUNT(CASE WHEN t.created_by = ? THEN 1 END) AS created_by_me,
      COUNT(CASE WHEN t.assignee_id = ? AND t.status = 'done' AND t.due_date != '' AND t.completed_at IS NOT NULL AND date(t.completed_at) <= date(t.due_date) THEN 1 END) AS completed_on_time,
      COUNT(CASE WHEN t.assignee_id = ? AND t.status = 'done' AND t.due_date != '' AND t.completed_at IS NOT NULL AND date(t.completed_at) > date(t.due_date) THEN 1 END) AS completed_late,
      ROUND(AVG(CASE WHEN t.assignee_id = ? AND t.status = 'done' AND t.completed_at IS NOT NULL THEN julianday(t.completed_at) - julianday(t.created_at) END), 1) AS avg_completion_days
    FROM todos t
    JOIN projects p ON t.project_id = p.id
    WHERE p.organization_id = ?
      AND (t.assignee_id = ? OR t.created_by = ? OR t.completed_by = ?)
      ${dateFilter}
  `).get(
    user.id, user.id, user.id, user.id, user.id, user.id, user.id, user.id, user.id,
    user.organization_id, user.id, user.id, user.id,
    ...dateArgs,
  );

  const statusBreakdown = db.prepare(`
    SELECT t.status, COUNT(*) AS count
    FROM todos t
    JOIN projects p ON t.project_id = p.id
    WHERE p.organization_id = ? AND t.assignee_id = ?
      ${start ? 'AND date(COALESCE(t.completed_at, t.created_at)) >= date(?)' : ''}
    GROUP BY t.status
  `).all(user.organization_id, user.id, ...dateArgs);

  const priorityBreakdown = db.prepare(`
    SELECT t.priority, COUNT(*) AS count
    FROM todos t
    JOIN projects p ON t.project_id = p.id
    WHERE p.organization_id = ? AND t.assignee_id = ? AND t.status != 'done'
    GROUP BY t.priority
  `).all(user.organization_id, user.id);

  const monthlyCompleted = db.prepare(`
    SELECT strftime('%Y-%m', t.completed_at) AS month, COUNT(*) AS count
    FROM todos t
    JOIN projects p ON t.project_id = p.id
    WHERE p.organization_id = ? AND t.assignee_id = ? AND t.completed_at IS NOT NULL
      ${start ? 'AND date(t.completed_at) >= date(?)' : ''}
    GROUP BY month
    ORDER BY month ASC
  `).all(user.organization_id, user.id, ...dateArgs);

  const monthlyCreated = db.prepare(`
    SELECT strftime('%Y-%m', t.created_at) AS month, COUNT(*) AS count
    FROM todos t
    JOIN projects p ON t.project_id = p.id
    WHERE p.organization_id = ? AND t.created_by = ?
      ${start ? 'AND date(t.created_at) >= date(?)' : ''}
    GROUP BY month
    ORDER BY month ASC
  `).all(user.organization_id, user.id, ...dateArgs);

  const recentCompletedTasks = db.prepare(`
    SELECT t.id, t.project_id, p.name AS project_name, t.title, t.priority, t.due_date, t.completed_at
    FROM todos t
    JOIN projects p ON t.project_id = p.id
    WHERE p.organization_id = ?
      AND (t.assignee_id = ? OR t.completed_by = ?)
      AND t.status = 'done'
      AND t.completed_at IS NOT NULL
    ORDER BY datetime(t.completed_at) DESC
    LIMIT 12
  `).all(user.organization_id, user.id, user.id);

  const projectSummary = db.prepare(`
    SELECT
      COUNT(DISTINCT p.id) AS involved_total,
      COUNT(DISTINCT CASE WHEN p.owner_id = ? THEN p.id END) AS owned_total,
      COUNT(DISTINCT CASE WHEN p.primary_assignee_id = ? THEN p.id END) AS primary_total,
      COUNT(DISTINCT CASE WHEN p.status = 'completed' THEN p.id END) AS completed_total,
      COUNT(DISTINCT CASE WHEN p.status = 'active' THEN p.id END) AS active_total,
      COUNT(DISTINCT CASE WHEN p.status = 'draft' THEN p.id END) AS draft_total
    FROM projects p
    LEFT JOIN project_members m ON p.id = m.project_id
    WHERE p.organization_id = ?
      AND (p.owner_id = ? OR p.primary_assignee_id = ? OR m.user_id = ?)
  `).get(user.id, user.id, user.organization_id, user.id, user.id, user.id);

  const recentCompletedProjects = db.prepare(`
    SELECT DISTINCT p.id, p.name, p.type, p.completed_at
    FROM projects p
    LEFT JOIN project_members m ON p.id = m.project_id
    WHERE p.organization_id = ?
      AND p.status = 'completed'
      AND p.completed_at IS NOT NULL
      AND (p.owner_id = ? OR p.primary_assignee_id = ? OR m.user_id = ?)
    ORDER BY datetime(p.completed_at) DESC
    LIMIT 8
  `).all(user.organization_id, user.id, user.id, user.id);

  const completionHistogram = db.prepare(`
    SELECT
      CASE
        WHEN julianday(t.completed_at) - julianday(t.created_at) < 1 THEN '当日'
        WHEN julianday(t.completed_at) - julianday(t.created_at) < 3 THEN '1-2日'
        WHEN julianday(t.completed_at) - julianday(t.created_at) < 7 THEN '3-6日'
        WHEN julianday(t.completed_at) - julianday(t.created_at) < 14 THEN '7-13日'
        WHEN julianday(t.completed_at) - julianday(t.created_at) < 30 THEN '14-29日'
        ELSE '30日+'
      END AS bucket,
      COUNT(*) AS count
    FROM todos t
    JOIN projects p ON t.project_id = p.id
    WHERE p.organization_id = ?
      AND t.assignee_id = ?
      AND t.status = 'done'
      AND t.completed_at IS NOT NULL
      ${start ? 'AND date(t.completed_at) >= date(?)' : ''}
    GROUP BY bucket
  `).all(user.organization_id, user.id, ...dateArgs);

  const weekdayHeatmap = db.prepare(`
    SELECT
      CAST(strftime('%w', t.completed_at) AS INTEGER) AS weekday,
      (CAST(strftime('%H', t.completed_at) AS INTEGER) / 3) * 3 AS hour,
      COUNT(*) AS count
    FROM todos t
    JOIN projects p ON t.project_id = p.id
    WHERE p.organization_id = ?
      AND (t.assignee_id = ? OR t.completed_by = ?)
      AND t.completed_at IS NOT NULL
      ${start ? 'AND date(t.completed_at) >= date(?)' : ''}
    GROUP BY weekday, hour
  `).all(user.organization_id, user.id, user.id, ...dateArgs);

  const projectTaskLoad = db.prepare(`
    SELECT
      p.id AS project_id,
      p.name AS project_name,
      COUNT(CASE WHEN t.assignee_id = ? AND t.status != 'done' THEN 1 END) AS open_count,
      COUNT(CASE WHEN t.assignee_id = ? AND t.status = 'done' THEN 1 END) AS completed_count,
      COUNT(CASE WHEN t.assignee_id = ? AND t.status != 'done' AND t.due_date != '' AND date(t.due_date) < date('now') THEN 1 END) AS overdue_count
    FROM projects p
    JOIN todos t ON t.project_id = p.id
    WHERE p.organization_id = ?
      AND t.assignee_id = ?
      ${start ? 'AND date(COALESCE(t.completed_at, t.created_at)) >= date(?)' : ''}
    GROUP BY p.id, p.name
    HAVING open_count > 0 OR completed_count > 0
    ORDER BY (open_count + completed_count) DESC, overdue_count DESC
    LIMIT 10
  `).all(user.id, user.id, user.id, user.organization_id, user.id, ...dateArgs);

  const cycleScatter = db.prepare(`
    SELECT
      t.id,
      t.project_id,
      p.name AS project_name,
      t.title,
      t.created_at,
      t.completed_at,
      t.due_date,
      ROUND(julianday(t.completed_at) - julianday(t.created_at), 1) AS completion_days,
      CASE
        WHEN t.due_date != '' THEN ROUND(julianday(t.completed_at) - julianday(t.due_date), 1)
        ELSE NULL
      END AS late_days
    FROM todos t
    JOIN projects p ON t.project_id = p.id
    WHERE p.organization_id = ?
      AND t.assignee_id = ?
      AND t.status = 'done'
      AND t.completed_at IS NOT NULL
      ${start ? 'AND date(t.completed_at) >= date(?)' : ''}
    ORDER BY datetime(t.completed_at) DESC
    LIMIT 80
  `).all(user.organization_id, user.id, ...dateArgs);

  const projectStatusBreakdown = db.prepare(`
    SELECT p.status, COUNT(DISTINCT p.id) AS count
    FROM projects p
    LEFT JOIN project_members m ON p.id = m.project_id
    WHERE p.organization_id = ?
      AND (p.owner_id = ? OR p.primary_assignee_id = ? OR m.user_id = ?)
    GROUP BY p.status
  `).all(user.organization_id, user.id, user.id, user.id);

  return NextResponse.json({
    range,
    start,
    task_summary: taskSummary,
    status_breakdown: statusBreakdown,
    priority_breakdown: priorityBreakdown,
    monthly_completed: monthlyCompleted,
    monthly_created: monthlyCreated,
    recent_completed_tasks: recentCompletedTasks,
    project_summary: projectSummary,
    recent_completed_projects: recentCompletedProjects,
    completion_histogram: completionHistogram,
    weekday_heatmap: weekdayHeatmap,
    project_task_load: projectTaskLoad,
    cycle_scatter: cycleScatter,
    project_status_breakdown: projectStatusBreakdown,
  });
}
