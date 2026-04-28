import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { validateParentChange } from '@/lib/project-relations';

interface Params { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  try {
    const user = await requireSession();
    const db = getDb();
    const body = await request.json() as { parent_project_id?: string | null };
    const parentProjectId = body.parent_project_id?.trim() || null;

    const validation = validateParentChange(db, params.id, parentProjectId, user.id);
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: validation.status });

    db.prepare(`
      UPDATE projects
      SET parent_project_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(parentProjectId, params.id);

    return NextResponse.json({ parent_project_id: parentProjectId });
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
