import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { requireProjectPermission } from '@/lib/permissions';

interface Params { params: Promise<{ id: string; relationId: string }> }

export async function DELETE(_request: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  try {
    const user = await requireSession();
    const db = getDb();
    if (!requireProjectPermission(db, params.id, user.id, 'edit_project')) {
      return NextResponse.json({ error: '編集権限がありません' }, { status: 403 });
    }

    const relation = db.prepare(`
      SELECT id
      FROM project_relations
      WHERE id = ? AND (project_a_id = ? OR project_b_id = ?)
    `).get(params.relationId, params.id, params.id);
    if (!relation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    db.prepare('DELETE FROM project_relations WHERE id = ?').run(params.relationId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
