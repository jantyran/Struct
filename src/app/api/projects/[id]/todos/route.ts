import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import type { Todo } from '@/types';

interface Params { params: { id: string } }

function checkProjectAccess(projectId: string, userId: string) {
  const db = getDb();
  return db.prepare(`
    SELECT DISTINCT p.* FROM projects p
    LEFT JOIN project_members m ON p.id = m.project_id
    WHERE p.id = ? AND (p.owner_id = ? OR m.user_id = ?)
  `).get(projectId, userId, userId);
}

/** Todoにアサイニー情報を付与 */
function attachAssignees(todos: Todo[]): Todo[] {
  const db = getDb();
  return todos.map(todo => {
    if (!todo.assignee_id) return todo;
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(todo.assignee_id) as { id: string; name: string | null; email: string } | undefined;
    return { ...todo, assignee: user ?? null };
  });
}

/** GET: Todo一覧 */
export async function GET(_req: Request, { params }: Params) {
  let user;
  try { user = await requireSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!checkProjectAccess(params.id, user.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const db = getDb();
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

  // 親タスクにサブタスクを紐付け
  const subtaskMap: Record<string, Todo[]> = {};
  for (const sub of subtasks) {
    if (!sub.parent_id) continue;
    if (!subtaskMap[sub.parent_id]) subtaskMap[sub.parent_id] = [];
    subtaskMap[sub.parent_id].push(sub);
  }

  const withSubs = parentTodos.map(t => ({ ...t, subtasks: subtaskMap[t.id] ?? [] }));
  return NextResponse.json(attachAssignees(withSubs));
}

/** POST: Todo作成 */
export async function POST(req: Request, { params }: Params) {
  let user;
  try { user = await requireSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!checkProjectAccess(params.id, user.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: Partial<Todo>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const title = (body.title ?? '').trim();
  if (!title) return NextResponse.json({ error: 'タイトルは必須です' }, { status: 400 });

  const db = getDb();
  const maxOrder = (db.prepare(`SELECT MAX(sort_order) as m FROM todos WHERE project_id = ? AND parent_id IS NULL`).get(params.id) as { m: number | null }).m ?? -1;

  const id = uuidv4();
  db.prepare(`
    INSERT INTO todos
      (id, project_id, parent_id, title, description, status, priority, assignee_id,
       phase_key, start_date, due_date, sort_order, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.id,
    body.parent_id ?? null,
    title,
    body.description ?? '',
    body.status ?? 'todo',
    body.priority ?? 'medium',
    body.assignee_id ?? null,
    body.phase_key ?? '',
    body.start_date ?? '',
    body.due_date ?? '',
    body.parent_id ? 0 : maxOrder + 1,
    user.id,
  );

  const created = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as Todo;
  return NextResponse.json(created, { status: 201 });
}
