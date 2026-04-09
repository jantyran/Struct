import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const user = await requireSession();
    const db = getDb();
    let assets = db.prepare('SELECT * FROM global_assets WHERE user_id = ?').get(user.id);

    if (!assets) {
      const id = uuidv4();
      db.prepare('INSERT INTO global_assets (id, user_id) VALUES (?, ?)').run(id, user.id);
      assets = db.prepare('SELECT * FROM global_assets WHERE id = ?').get(id);
    }

    return NextResponse.json(assets);
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireSession();
    const db = getDb();
    const body = await request.json() as {
      company_name?: string;
      company_description?: string;
      brand_voice?: string;
      brand_guidelines?: string;
      products?: any[];
    };

    db.prepare(`
      UPDATE global_assets SET
        company_name = ?,
        company_description = ?,
        brand_voice = ?,
        brand_guidelines = ?,
        products = ?,
        updated_at = datetime('now')
      WHERE user_id = ?
    `).run(
      body.company_name ?? '',
      body.company_description ?? '',
      body.brand_voice ?? '',
      body.brand_guidelines ?? '',
      body.products ? JSON.stringify(body.products) : '[]',
      user.id
    );

    const updated = db.prepare('SELECT * FROM global_assets WHERE user_id = ?').get(user.id);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
