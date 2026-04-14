import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { maskAISettings, normalizeAISettings, normalizeAISettingsRow, serializeAISettings } from '@/lib/ai/settings';

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
    const settings = normalizeAISettingsRow(row);
    return NextResponse.json({
      settings: maskAISettings(settings),
      has_api_key: Boolean(settings.api_key),
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireSession();
    await ensureSettingsRow(user.id);
    const db = getDb();
    const body = await request.json() as { settings?: unknown };
    const settings = normalizeAISettings((body.settings as any) || {});

    db.prepare(`
      UPDATE global_assets SET
        ai_settings = ?,
        updated_at = datetime('now')
      WHERE user_id = ?
    `).run(serializeAISettings(settings), user.id);

    return NextResponse.json({
      settings: maskAISettings(settings),
      has_api_key: Boolean(settings.api_key),
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
