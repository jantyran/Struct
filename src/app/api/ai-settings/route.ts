import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthSession } from '@/lib/auth';
import { maskAISettings, normalizeAISettings, normalizeAISettingsRow, serializeAISettings } from '@/lib/ai/settings';
import { getOrganizationSettingsRow } from '@/lib/organization-settings';

export async function GET() {
  const { user, errorResponse } = await getAuthSession();
  if (errorResponse) return errorResponse;

  if (!user.system_permissions.manage_ai_settings) {
    return NextResponse.json({ error: 'AI設定管理権限がありません' }, { status: 403 });
  }

  try {
    const db = getDb();
    const row = getOrganizationSettingsRow(db, user.organization_id);
    const settings = normalizeAISettingsRow(row);
    return NextResponse.json({
      settings: maskAISettings(settings),
      has_api_key: Boolean(settings.api_key),
    });
  } catch (err) {
    console.error('GET /api/ai-settings failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { user, errorResponse } = await getAuthSession();
  if (errorResponse) return errorResponse;

  if (!user.system_permissions.manage_ai_settings) {
    return NextResponse.json({ error: 'AI設定管理権限がありません' }, { status: 403 });
  }

  try {
    const db = getDb();
    const body = await request.json() as { settings?: unknown };
    const settings = normalizeAISettings((body.settings as Partial<import('@/types').AISettings>) || {});
    getOrganizationSettingsRow(db, user.organization_id);

    db.prepare(`
      UPDATE organization_settings SET
        ai_settings = ?,
        updated_at = datetime('now')
      WHERE organization_id = ?
    `).run(serializeAISettings(settings), user.organization_id);

    return NextResponse.json({
      settings: maskAISettings(settings),
      has_api_key: Boolean(settings.api_key),
    });
  } catch (err) {
    console.error('PUT /api/ai-settings failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
