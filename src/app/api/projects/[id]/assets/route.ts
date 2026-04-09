import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { GeneratedAsset } from '@/types';

interface Params { params: { id: string } }

export async function GET(_req: Request, { params }: Params) {
  const db = getDb();
  const assets = db.prepare(
    'SELECT * FROM generated_assets WHERE project_id = ? ORDER BY created_at DESC'
  ).all(params.id) as GeneratedAsset[];

  return NextResponse.json(assets.map(a => ({
    ...a,
    warnings: JSON.parse(a.warnings || '[]'),
  })));
}

export async function DELETE(request: Request, { params }: Params) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get('assetId');

  if (!assetId) {
    // プロジェクトの全アセットを削除
    db.prepare('DELETE FROM generated_assets WHERE project_id = ?').run(params.id);
  } else {
    db.prepare('DELETE FROM generated_assets WHERE id = ? AND project_id = ?').run(assetId, params.id);
  }

  return NextResponse.json({ success: true });
}
