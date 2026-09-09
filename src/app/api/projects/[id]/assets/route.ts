import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthSession } from '@/lib/auth';
import { requireProjectPermission } from '@/lib/permissions';

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  const { user, errorResponse } = await getAuthSession();
  if (errorResponse) return errorResponse;

  const db = getDb();
  if (!requireProjectPermission(db, params.id, user, 'view_content')) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const assets = db.prepare(`
      SELECT * FROM generated_assets WHERE project_id = ? ORDER BY created_at DESC
    `).all(params.id);
    return NextResponse.json(assets);
  } catch (err) {
    console.error('GET /api/projects/[id]/assets failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  const { user, errorResponse } = await getAuthSession();
  if (errorResponse) return errorResponse;

  const db = getDb();
  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get('assetId');

  if (!requireProjectPermission(db, params.id, user, 'generate_content')) return NextResponse.json({ error: 'コンテンツ編集権限がありません' }, { status: 403 });

  try {
    if (!assetId) {
      db.prepare('DELETE FROM generated_assets WHERE project_id = ?').run(params.id);
    } else {
      db.prepare('DELETE FROM generated_assets WHERE id = ? AND project_id = ?').run(assetId, params.id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/projects/[id]/assets failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  const { user, errorResponse } = await getAuthSession();
  if (errorResponse) return errorResponse;

  const db = getDb();
  if (!requireProjectPermission(db, params.id, user, 'generate_content')) return NextResponse.json({ error: 'コンテンツ編集権限がありません' }, { status: 403 });

  let body: { assetId?: string; title?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.assetId) return NextResponse.json({ error: 'assetId is required' }, { status: 400 });

  try {
    const existing = db.prepare(`
      SELECT * FROM generated_assets WHERE id = ? AND project_id = ?
    `).get(body.assetId, params.id) as { id: string; title: string; content: string } | undefined;

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
    console.error('PATCH /api/projects/[id]/assets failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
