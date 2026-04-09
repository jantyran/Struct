import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const row = db.prepare('SELECT * FROM global_assets WHERE id = ?').get('main');
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const assets = row as Record<string, unknown>;
  assets.products = JSON.parse((assets.products as string) || '[]');
  return NextResponse.json(assets);
}

export async function PUT(request: Request) {
  const db = getDb();
  const body = await request.json() as {
    company_name?: string;
    company_description?: string;
    brand_voice?: string;
    brand_guidelines?: string;
    products?: unknown[];
  };

  db.prepare(`
    UPDATE global_assets SET
      company_name = ?,
      company_description = ?,
      brand_voice = ?,
      brand_guidelines = ?,
      products = ?,
      updated_at = datetime('now')
    WHERE id = 'main'
  `).run(
    body.company_name ?? '',
    body.company_description ?? '',
    body.brand_voice ?? '',
    body.brand_guidelines ?? '',
    JSON.stringify(body.products ?? []),
  );

  const updated = db.prepare('SELECT * FROM global_assets WHERE id = ?').get('main') as Record<string, unknown>;
  updated.products = JSON.parse((updated.products as string) || '[]');
  return NextResponse.json(updated);
}
