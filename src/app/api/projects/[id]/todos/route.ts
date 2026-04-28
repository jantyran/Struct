import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import type { Todo } from '@/types';
import { requireProjectPermission } from '@/lib/permissions';

interface Params { params: Promise<{ id: string }> }

/** Todoにアサイニー情報を付与 */
function attachAssignees(todos: Todo[]): Todo[] {
  const assigneeIds = Array.from(new Set(todos.map((todo) => todo.assignee_id).filter(Boolean))) as string[];
  if (assigneeIds.length === 0) return todos;

  const db = getDb();
  const placeholders = assigneeIds.map(() => '?').join(',');
  const users = db.prepare(`
    SELECT id, name, email FROM users WHERE id IN (${placeholders})
  `).all(...assigneeIds) as Array<{ id: string; name: string | null; email: string }>;
  const userById = new Map(users.map((user) => [user.id, user]));

  return todos.map(todo => {
    if (!todo.assignee_id) return todo;
    return { ...todo, assignee: userById.get(todo.assignee_id) ?? null };
  });
}

/** GET: Todo一覧 */
export async function GET(_req: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  let user;
  try { user = await requireSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  if (!requireProjectPermission(db, params.id, user.id, 'view_items')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // 親タスクのみ取得（サブタスクは subtasks フィールドで返す）
  const parentTodos = db.prepare(`
    SELECT * FROM todos
    WHERE project_id = ? AND parent_id IS NULL
    ORDER BY sort_order ASC, created_at ASC
  `).all(params.id) as Todo[];

  const subtasks = db.prepare(`
    SELECT * FROM todos
    WHERE project_id = ? AND parent_id IS NOT NULL
    ORDER BY sort_order ASC, created_at ASC
  `).all(params.id) as Todo[];

  const parentTodosWithAssignees = attachAssignees(parentTodos);
  const subtasksWithAssignees = attachAssignees(subtasks);

  // 親タスクにサブタスクを紐付け
  const subtaskMap: Record<string, Todo[]> = {};
  for (const sub of subtasksWithAssignees) {
    if (!sub.parent_id) continue;
    if (!subtaskMap[sub.parent_id]) subtaskMap[sub.parent_id] = [];
    subtaskMap[sub.parent_id].push(sub);
  }

  const withSubs = parentTodosWithAssignees.map(t => ({ ...t, subtasks: subtaskMap[t.id] ?? [] }));
  return NextResponse.json(withSubs);
}

/** POST: Todo作成 */
export async function POST(req: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  let user;
  try { user = await requireSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  if (!requireProjectPermission(db, params.id, user.id, 'edit_items')) {
    return NextResponse.json({ error: 'タスク編集権限がありません' }, { status: 403 });
  }

  let body: Partial<Todo>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const title = (body.title ?? '').trim();
  if (!title) return NextResponse.json({ error: 'タイトルは必須です' }, { status: 400 });

  if (body.parent_id) {
    const parent = db.prepare('SELECT 1 FROM todos WHERE id = ? AND project_id = ?').get(body.parent_id, params.id);
    if (!parent) return NextResponse.json({ error: '親タスクが見つかりません' }, { status: 400 });
  }
  const maxOrder = (db.prepare(`SELECT MAX(sort_order) as m FROM todos WHERE project_id = ? AND parent_id IS NULL`).get(params.id) as { m: number | null }).m ?? -1;

  const id = uuidv4();
  const status = body.status ?? 'todo';
  const completedAt = status === 'done' ? new Date().toISOString() : null;
  const tagsRaw = Array.isArray(body.tags) ? JSON.stringify(body.tags) : (body.tags ?? '[]');
  db.prepare(`
    INSERT INTO todos
      (id, project_id, parent_id, title, description, status, priority, assignee_id,
       phase_key, start_date, due_date, sort_order, created_by, completed_at, completed_by, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.id,
    body.parent_id ?? null,
    title,
    body.description ?? '',
    status,
    body.priority ?? 'medium',
    body.assignee_id ?? null,
    body.phase_key ?? '',
    body.start_date ?? '',
    body.due_date ?? '',
    body.parent_id ? 0 : maxOrder + 1,
    user.id,
    completedAt,
    completedAt ? user.id : null,
    tagsRaw,
  );

  const created = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as Todo;
  return NextResponse.json(created, { status: 201 });
}
