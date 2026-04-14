import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { createContentTemplate, normalizeContentTemplates, normalizeContentTemplatesRow, serializeContentTemplates } from '@/lib/content-templates';

async function ensureSettingsRow(userId: string) {
  const db = getDb();
  let row = db.prepare('SELECT * FROM global_assets WHERE user_id = ?').get(userId) as any;
  if (!row) {
    const id = uuidv4();
    db.prepare('INSERT INTO global_assets (id, user_id) VALUES (?, ?)').run(id, userId);
    row = db.prepare('SELECT * FROM global_assets WHERE id = ?').get(id);
  }
  return row;
}

export async function GET() {
  try {
    const user = await requireSession();
    const row = await ensureSettingsRow(user.id);
    return NextResponse.json({ content_templates: normalizeContentTemplatesRow(row) });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireSession();
    await ensureSettingsRow(user.id);
    const db = getDb();
    const body = await request.json() as { content_templates?: unknown };
    const templates = normalizeContentTemplates(body.content_templates as any[]);

    db.prepare(`
      UPDATE global_assets SET
        content_templates = ?,
        updated_at = datetime('now')
      WHERE user_id = ?
    `).run(serializeContentTemplates(templates), user.id);

    const updated = db.prepare('SELECT * FROM global_assets WHERE user_id = ?').get(user.id) as any;
    return NextResponse.json({ content_templates: normalizeContentTemplatesRow(updated) });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
