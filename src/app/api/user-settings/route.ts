import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { normalizeUserSettings, parseUserSettingsRow, serializeUserSettings } from '@/lib/user-settings';

export async function GET() {
  try {
    const user = await requireSession();
    const db = getDb();
    const row = db.prepare('SELECT user_settings FROM users WHERE id = ?').get(user.id) as { user_settings?: string } | undefined;
    return NextResponse.json({ settings: parseUserSettingsRow(row?.user_settings) });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireSession();
    const body = await request.json();
    const settings = normalizeUserSettings(body);
    const db = getDb();
    db.prepare('UPDATE users SET user_settings = ? WHERE id = ?').run(serializeUserSettings(settings), user.id);
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'ユーザー設定の更新に失敗しました。' }, { status: 500 });
  }
}
