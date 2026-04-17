import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { maskAISettings, normalizeAISettings, normalizeAISettingsRow, serializeAISettings } from '@/lib/ai/settings';
import { DEFAULT_ORGANIZATION_SCOPE, getOrganizationSettingsRow } from '@/lib/organization-settings';
import { hasSystemPermission } from '@/lib/permissions';

export async function GET() {
  try {
    const user = await requireSession();
    const db = getDb();
    if (!hasSystemPermission(db, user.id, 'manage_ai_settings')) {
      return NextResponse.json({ error: 'AI設定管理権限がありません' }, { status: 403 });
    }
    const row = getOrganizationSettingsRow(db);
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
    const db = getDb();
    if (!hasSystemPermission(db, user.id, 'manage_ai_settings')) {
      return NextResponse.json({ error: 'AI設定管理権限がありません' }, { status: 403 });
    }
    const body = await request.json() as { settings?: unknown };
    const settings = normalizeAISettings((body.settings as any) || {});
    getOrganizationSettingsRow(db);

    db.prepare(`
      UPDATE organization_settings SET
        ai_settings = ?,
        updated_at = datetime('now')
      WHERE scope_key = ?
    `).run(serializeAISettings(settings), DEFAULT_ORGANIZATION_SCOPE);

    return NextResponse.json({
      settings: maskAISettings(settings),
      has_api_key: Boolean(settings.api_key),
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
