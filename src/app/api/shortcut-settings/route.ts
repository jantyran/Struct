import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getOrganizationSettingsRow } from '@/lib/organization-settings';
import { hasSystemPermission } from '@/lib/permissions';
import { normalizeShortcutSettings, normalizeShortcutSettingsRow, serializeShortcutSettings } from '@/lib/shortcut-settings';

export async function GET() {
  try {
    const user = await requireSession();
    const db = getDb();
    const row = getOrganizationSettingsRow(db, user.organization_id);
    return NextResponse.json({
      settings: normalizeShortcutSettingsRow(row),
      can_edit: hasSystemPermission(db, user.id, 'manage_organization_settings'),
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireSession();
    const db = getDb();

    if (!hasSystemPermission(db, user.id, 'manage_organization_settings')) {
      return NextResponse.json({ error: 'ショートカット設定の編集権限がありません' }, { status: 403 });
    }

    const body = await request.json() as { settings?: unknown };
    const settings = normalizeShortcutSettings(body.settings);

    db.prepare(`
      UPDATE organization_settings SET
        shortcut_settings = ?,
        updated_at = datetime('now')
      WHERE organization_id = ?
    `).run(serializeShortcutSettings(settings), user.organization_id);

    return NextResponse.json({
      settings,
      can_edit: true,
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
