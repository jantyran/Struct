import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { getProjectRelations, normalizeRelationPair, validateProjectRelation } from '@/lib/project-relations';

interface Params { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  try {
    const user = await requireSession();
    const db = getDb();
    const payload = getProjectRelations(db, params.id, user.id);
    if (!payload) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(request: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  try {
    const user = await requireSession();
    const db = getDb();
    const body = await request.json() as { target_project_id?: string };
    const targetProjectId = body.target_project_id?.trim();
    if (!targetProjectId) return NextResponse.json({ error: '関連プロジェクトを選択してください' }, { status: 400 });

    const validation = validateProjectRelation(db, params.id, targetProjectId, user.id);
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: validation.status });

    const { projectAId, projectBId } = normalizeRelationPair(params.id, targetProjectId);
    const existing = db.prepare(`
      SELECT id FROM project_relations
      WHERE project_a_id = ? AND project_b_id = ?
    `).get(projectAId, projectBId);
    if (existing) return NextResponse.json({ error: '既に関連プロジェクトに追加されています' }, { status: 409 });

    const relationId = uuidv4();
    db.prepare(`
      INSERT INTO project_relations (id, project_a_id, project_b_id, created_by)
      VALUES (?, ?, ?, ?)
    `).run(relationId, projectAId, projectBId, user.id);

    return NextResponse.json({ id: relationId }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
