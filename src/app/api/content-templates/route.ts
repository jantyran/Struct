import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { normalizeContentTemplates, normalizeContentTemplatesRow, serializeContentTemplates } from '@/lib/content-templates';
import { getOrganizationSettingsRow } from '@/lib/organization-settings';
import { hasSystemPermission } from '@/lib/permissions';

export async function GET() {
  try {
    const user = await requireSession();
    const db = getDb();
    const row = getOrganizationSettingsRow(db, user.organization_id);
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
    getOrganizationSettingsRow(db, user.organization_id);

    db.prepare(`
      UPDATE organization_settings SET
        content_templates = ?,
        updated_at = datetime('now')
      WHERE organization_id = ?
    `).run(serializeContentTemplates(templates), user.organization_id);

    const updated = getOrganizationSettingsRow(db, user.organization_id);
    return NextResponse.json({ content_templates: normalizeContentTemplatesRow(updated) });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
