import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';

type RangeKey = '30' | '90' | '180' | '365' | 'all';

// 組織のタイムゾーン名から UTC オフセット（分）を計算
function getTzOffsetMinutes(tzName: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tzName, timeZoneName: 'longOffset' });
    const tzPart = formatter.formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value ?? '';
    const match = tzPart.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (!match) return 0;
    const sign = match[1] === '+' ? 1 : -1;
    return sign * (parseInt(match[2]) * 60 + parseInt(match[3]));
  } catch { return 0; }
}

// SQLite の datetime() に渡すオフセット修飾子付きの列式を返す
// 例: localDt('t.completed_at', 540) → "datetime(t.completed_at, '+540 minutes')"
function localDt(col: string, offsetMin: number): string {
  if (offsetMin === 0) return col;
  const sign = offsetMin > 0 ? '+' : '';
  return `datetime(${col}, '${sign}${offsetMin} minutes')`;
}

function rangeStart(range: RangeKey): string | null {
  if (range === 'all') return null;
  const date = new Date();
  date.setDate(date.getDate() - Number(range));
  return date.toISOString().slice(0, 10);
}

function prevRangeStart(range: RangeKey): string | null {
  if (range === 'all') return null;
  const date = new Date();
  date.setDate(date.getDate() - Number(range) * 2);
  return date.toISOString().slice(0, 10);
}

function computeStreaks(rows: Array<{ day: string }>) {
  const days = rows.map(r => r.day).sort();
  if (days.length === 0) return { best_streak: 0, current_streak: 0 };

  let bestStreak = 1, run = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = Math.round((new Date(days[i]).getTime() - new Date(days[i - 1]).getTime()) / 86400000);
    run = diff === 1 ? run + 1 : 1;
    if (run > bestStreak) bestStreak = run;
  }

  const daySet = new Set(days);
  let currentStreak = 0;
  const today = new Date();
  let check = today.toISOString().slice(0, 10);
  while (daySet.has(check)) {
    currentStreak++;
    today.setDate(today.getDate() - 1);
    check = today.toISOString().slice(0, 10);
  }

  return { best_streak: bestStreak, current_streak: currentStreak };
}

function buildTaskSummaryQuery(userId: string, orgId: string, startDate: string | null, endDate: string | null) {
  const db = getDb();
  const filter = startDate
    ? endDate
      ? `AND date(COALESCE(t.completed_at, t.created_at)) >= date(?) AND date(COALESCE(t.completed_at, t.created_at)) < date(?)`
      : `AND date(COALESCE(t.completed_at, t.created_at)) >= date(?)`
    : '';
  const args: unknown[] = startDate ? (endDate ? [startDate, endDate] : [startDate]) : [];

  return db.prepare(`
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
      ${filter}
  `).get(
    userId, userId, userId, userId, userId, userId, userId, userId, userId,
    orgId, userId, userId, userId,
    ...args,
  );
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
  const validRange: RangeKey = (['30', '90', '180', '365', 'all'] as RangeKey[]).includes(range) ? range : '180';
  const start = rangeStart(validRange);
  const prevStart = prevRangeStart(validRange);
  const db = getDb();
  const dateArgs = start ? [start] : [];

  // 組織のタイムゾーン取得 → UTC→ローカル変換用オフセット（分）
  const orgTz = (db.prepare('SELECT default_time_zone FROM organizations WHERE id = ?')
    .get(user.organization_id) as { default_time_zone?: string } | undefined)?.default_time_zone ?? 'Asia/Tokyo';
  const tzOffsetMin = getTzOffsetMinutes(orgTz);
  // 時刻依存クエリで使うローカル時刻列式（例: JST なら "datetime(col, '+540 minutes')"）
  const lCompletedAt = localDt('t.completed_at', tzOffsetMin);
  const lCreatedAt = localDt('t.created_at', tzOffsetMin);

  const taskSummary = buildTaskSummaryQuery(user.id, user.organization_id, start, null);
  const prevTaskSummary = validRange !== 'all'
    ? buildTaskSummaryQuery(user.id, user.organization_id, prevStart, start)
    : null;

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

  // ヒートマップ：UTCではなく組織のローカル時刻で集計
  const weekdayHeatmap = db.prepare(`
    SELECT
      CAST(strftime('%w', ${lCompletedAt}) AS INTEGER) AS weekday,
      CAST(strftime('%H', ${lCompletedAt}) AS INTEGER) AS hour,
      COUNT(*) AS count
    FROM todos t
    JOIN projects p ON t.project_id = p.id
    WHERE p.organization_id = ?
      AND (t.assignee_id = ? OR t.completed_by = ?)
      AND t.completed_at IS NOT NULL
      ${start ? `AND date(${lCompletedAt}) >= date(?)` : ''}
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

  // 週次完了数（ローカル曜日で週の開始日を計算）
  const weeklyCompleted = db.prepare(`
    SELECT
      date(${lCompletedAt}, '-' || CAST(strftime('%w', ${lCompletedAt}) AS INTEGER) || ' days') AS week,
      COUNT(*) AS count
    FROM todos t
    JOIN projects p ON t.project_id = p.id
    WHERE p.organization_id = ? AND t.assignee_id = ? AND t.completed_at IS NOT NULL
      ${start ? `AND date(${lCompletedAt}) >= date(?)` : ''}
    GROUP BY week
    ORDER BY week ASC
  `).all(user.organization_id, user.id, ...dateArgs);

  const weeklyCreated = db.prepare(`
    SELECT
      date(${lCreatedAt}, '-' || CAST(strftime('%w', ${lCreatedAt}) AS INTEGER) || ' days') AS week,
      COUNT(*) AS count
    FROM todos t
    JOIN projects p ON t.project_id = p.id
    WHERE p.organization_id = ? AND t.created_by = ?
      ${start ? `AND date(${lCreatedAt}) >= date(?)` : ''}
    GROUP BY week
    ORDER BY week ASC
  `).all(user.organization_id, user.id, ...dateArgs);

  // 過去365日の日別完了数（カレンダーグラフ用・ローカル日付で集計）
  const dailyCompletions = db.prepare(`
    SELECT date(${lCompletedAt}) AS day, COUNT(*) AS count
    FROM todos t
    JOIN projects p ON t.project_id = p.id
    WHERE p.organization_id = ?
      AND (t.assignee_id = ? OR t.completed_by = ?)
      AND t.completed_at IS NOT NULL
      AND date(${lCompletedAt}) >= date('now', '${tzOffsetMin >= 0 ? '+' : ''}${tzOffsetMin} minutes', '-365 days')
    GROUP BY day
    ORDER BY day ASC
  `).all(user.organization_id, user.id, user.id) as Array<{ day: string; count: number }>;

  // タグ別集計
  let tagBreakdown: Array<{ tag: string; count: number }> = [];
  try {
    tagBreakdown = db.prepare(`
      SELECT je.value AS tag, COUNT(*) AS count
      FROM todos t
      JOIN projects p ON t.project_id = p.id, json_each(COALESCE(NULLIF(t.tags, ''), '[]')) AS je
      WHERE p.organization_id = ?
        AND (t.assignee_id = ? OR t.completed_by = ?)
        AND json_valid(COALESCE(t.tags, '[]'))
        AND je.value != ''
        ${start ? 'AND date(COALESCE(t.completed_at, t.created_at)) >= date(?)' : ''}
      GROUP BY je.value
      ORDER BY count DESC
      LIMIT 20
    `).all(user.organization_id, user.id, user.id, ...dateArgs) as Array<{ tag: string; count: number }>;
  } catch { /* json_each 非対応環境用フォールバック */ }

  const streaks = computeStreaks(dailyCompletions);

  return NextResponse.json({
    range: validRange,
    start,
    task_summary: taskSummary,
    prev_task_summary: prevTaskSummary,
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
    daily_completions: dailyCompletions,
    weekly_completed: weeklyCompleted,
    weekly_created: weeklyCreated,
    tag_breakdown: tagBreakdown,
    streaks,
  });
}
