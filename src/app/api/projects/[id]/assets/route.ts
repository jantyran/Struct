import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { requireProjectPermission } from '@/lib/permissions';

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  try {
    const user = await requireSession();
    const db = getDb();

    // Check access
    const project = db.prepare(`
      SELECT DISTINCT p.id FROM projects p
      LEFT JOIN project_members m ON p.id = m.project_id
      WHERE p.id = ? AND p.organization_id = ? AND (p.owner_id = ? OR m.user_id = ?)
    `).get(params.id, user.organization_id, user.id, user.id);

    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!requireProjectPermission(db, params.id, user.id, 'view_content')) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const assets = db.prepare(`
      SELECT * FROM generated_assets WHERE project_id = ? ORDER BY created_at DESC
    `).all(params.id);
    
    return NextResponse.json(assets);
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function DELETE(request: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  try {
    const user = await requireSession();
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId');

    const project = db.prepare(`
      SELECT DISTINCT p.id FROM projects p
      LEFT JOIN project_members m ON p.id = m.project_id
      WHERE p.id = ? AND p.organization_id = ? AND (p.owner_id = ? OR m.user_id = ?)
    `).get(params.id, user.organization_id, user.id, user.id);

    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!requireProjectPermission(db, params.id, user.id, 'generate_content')) return NextResponse.json({ error: 'コンテンツ編集権限がありません' }, { status: 403 });

    if (!assetId) {
      db.prepare('DELETE FROM generated_assets WHERE project_id = ?').run(params.id);
    } else {
      db.prepare('DELETE FROM generated_assets WHERE id = ? AND project_id = ?').run(assetId, params.id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function PATCH(request: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  try {
    const user = await requireSession();
    const db = getDb();
    const body = await request.json() as { assetId?: string; title?: string; content?: string };

    const project = db.prepare(`
      SELECT DISTINCT p.id FROM projects p
      LEFT JOIN project_members m ON p.id = m.project_id
      WHERE p.id = ? AND p.organization_id = ? AND (p.owner_id = ? OR m.user_id = ?)
    `).get(params.id, user.organization_id, user.id, user.id);

    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!requireProjectPermission(db, params.id, user.id, 'generate_content')) return NextResponse.json({ error: 'コンテンツ編集権限がありません' }, { status: 403 });
    if (!body.assetId) return NextResponse.json({ error: 'assetId is required' }, { status: 400 });

    const existing = db.prepare(`
      SELECT * FROM generated_assets WHERE id = ? AND project_id = ?
    `).get(body.assetId, params.id) as any;

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    db.prepare(`
      UPDATE generated_assets SET
        title = ?,
        content = ?
      WHERE id = ? AND project_id = ?
    `).run(
      body.title ?? existing.title,
      body.content ?? existing.content,
      body.assetId,
      params.id
    );

    const updated = db.prepare('SELECT * FROM generated_assets WHERE id = ?').get(body.assetId);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
