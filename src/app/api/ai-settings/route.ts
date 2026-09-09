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
    const rawSettings = (body.settings as Partial<import('@/types').AISettings>) || {};

    const currentRow = getOrganizationSettingsRow(db, user.organization_id);
    const currentSettings = normalizeAISettingsRow(currentRow);

    // 新しい API キーが未入力（空文字やマスク文字列）の場合は既存のキーを維持
    const newApiKey = typeof rawSettings.api_key === 'string' ? rawSettings.api_key.trim() : '';
    const shouldKeepExistingKey = !newApiKey || newApiKey.includes('••••');
    const finalApiKey = shouldKeepExistingKey ? currentSettings.api_key : newApiKey;

    const settings = normalizeAISettings({
      ...rawSettings,
      api_key: finalApiKey,
    });

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
