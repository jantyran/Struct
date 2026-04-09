import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';

interface Params { params: { id: string } }

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireSession();
    const db = getDb();

    // Check access
    const project = db.prepare(`
      SELECT DISTINCT p.id FROM projects p
      LEFT JOIN project_members m ON p.id = m.project_id
      WHERE p.id = ? AND (p.owner_id = ? OR m.user_id = ?)
    `).get(params.id, user.id, user.id);

    if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const assets = db.prepare(`
      SELECT * FROM generated_assets WHERE project_id = ? ORDER BY created_at DESC
    `).all(params.id);
    
    return NextResponse.json(assets);
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const user = await requireSession();
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId');

    const project = db.prepare(`
      SELECT DISTINCT p.id FROM projects p
      LEFT JOIN project_members m ON p.id = m.project_id
      WHERE p.id = ? AND (p.owner_id = ? OR m.user_id = ?)
    `).get(params.id, user.id, user.id);

    if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
