import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import type { Todo } from '@/types';

interface Params { params: { id: string; todoId: string } }

function checkProjectAccess(projectId: string, userId: string) {
  const db = getDb();
  const user = db.prepare('SELECT organization_id FROM users WHERE id = ?').get(userId) as { organization_id?: string | null } | undefined;
  return db.prepare(`
    SELECT DISTINCT p.* FROM projects p
    LEFT JOIN project_members m ON p.id = m.project_id
    WHERE p.id = ? AND p.organization_id = ? AND (p.owner_id = ? OR m.user_id = ?)
  `).get(projectId, user?.organization_id ?? null, userId, userId);
}

/** PATCH: Todo更新 */
export async function PATCH(req: Request, { params }: Params) {
  let user;
  try { user = await requireSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!checkProjectAccess(params.id, user.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const db = getDb();
  const todo = db.prepare('SELECT * FROM todos WHERE id = ? AND project_id = ?').get(params.todoId, params.id) as Todo | undefined;
  if (!todo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: Partial<Todo>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 更新可能フィールドのみ適用
  const updates: Record<string, unknown> = {};
  const allowed = ['title', 'description', 'status', 'priority', 'assignee_id', 'phase_key', 'start_date', 'due_date', 'sort_order', 'parent_id'] as const;
  for (const key of allowed) {
    if (key in body) updates[key] = body[key] ?? null;
  }
  if ('status' in updates) {
    if (updates.status === 'done' && todo.status !== 'done') {
      updates.completed_at = new Date().toISOString();
      updates.completed_by = user.id;
    } else if (updates.status !== 'done') {
      updates.completed_at = null;
      updates.completed_by = null;
    }
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(todo);
  }

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = Object.values(updates);
  db.prepare(`UPDATE todos SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`).run(...values, params.todoId);

  const updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(params.todoId) as Todo;
  return NextResponse.json(updated);
}

/** DELETE: Todo削除 */
export async function DELETE(_req: Request, { params }: Params) {
  let user;
  try { user = await requireSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!checkProjectAccess(params.id, user.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const db = getDb();
  const todo = db.prepare('SELECT * FROM todos WHERE id = ? AND project_id = ?').get(params.todoId, params.id);
  if (!todo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  db.prepare('DELETE FROM todos WHERE id = ?').run(params.todoId);
  return NextResponse.json({ ok: true });
}
