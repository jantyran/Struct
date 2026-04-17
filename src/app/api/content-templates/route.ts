import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { normalizeContentTemplates, normalizeContentTemplatesRow, serializeContentTemplates } from '@/lib/content-templates';
import { DEFAULT_ORGANIZATION_SCOPE, getOrganizationSettingsRow } from '@/lib/organization-settings';
import { hasSystemPermission } from '@/lib/permissions';

export async function GET() {
  try {
    await requireSession();
    const db = getDb();
    const row = getOrganizationSettingsRow(db);
    return NextResponse.json({ content_templates: normalizeContentTemplatesRow(row) });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireSession();
    const db = getDb();
    if (!hasSystemPermission(db, user.id, 'manage_project_settings')) {
      return NextResponse.json({ error: 'プロジェクト設定管理権限がありません' }, { status: 403 });
    }
    const body = await request.json() as { content_templates?: unknown };
    const templates = normalizeContentTemplates(body.content_templates as any[]);
    getOrganizationSettingsRow(db);

    db.prepare(`
      UPDATE organization_settings SET
        content_templates = ?,
        updated_at = datetime('now')
      WHERE scope_key = ?
    `).run(serializeContentTemplates(templates), DEFAULT_ORGANIZATION_SCOPE);

    const updated = getOrganizationSettingsRow(db);
    return NextResponse.json({ content_templates: normalizeContentTemplatesRow(updated) });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
