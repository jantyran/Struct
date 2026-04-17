import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { normalizeProjectTypeDefinitions, normalizeProjectTypeDefinitionsRow, serializeProjectTypeDefinitions } from '@/lib/project-types';
import { persistProjectCustomFields, syncCustomFieldsWithDefinition } from '@/lib/project-field-sync';
import type { CustomField } from '@/types';
import { getOrganizationSettingsRow } from '@/lib/organization-settings';
import { hasSystemPermission } from '@/lib/permissions';

export async function GET() {
  let user;
  try {
    user = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();
    const assets = getOrganizationSettingsRow(db, user.organization_id);
    return NextResponse.json({ project_types: normalizeProjectTypeDefinitionsRow(assets) });
  } catch (err) {
    console.error('GET /api/project-types failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  let user;
  try {
    user = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();
    if (!hasSystemPermission(db, user.id, 'manage_project_settings')) {
      return NextResponse.json({ error: 'プロジェクト設定管理権限がありません' }, { status: 403 });
    }
    const body = await request.json() as { project_types?: unknown };
    const definitions = normalizeProjectTypeDefinitions(body.project_types as any[]);
    getOrganizationSettingsRow(db, user.organization_id);

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE organization_settings SET
          project_types = ?,
          updated_at = datetime('now')
        WHERE organization_id = ?
      `).run(serializeProjectTypeDefinitions(definitions), user.organization_id);

      const projects = db.prepare('SELECT id, type FROM projects WHERE organization_id = ?').all(user.organization_id) as Array<{ id: string; type: string }>;
      for (const project of projects) {
        const existingFields = db.prepare('SELECT * FROM custom_fields WHERE project_id = ? ORDER BY sort_order ASC').all(project.id) as CustomField[];
        const definition = definitions.find((item) => item.key === project.type);
        const syncedFields = syncCustomFieldsWithDefinition(project.id, existingFields, definition);
        persistProjectCustomFields(db, project.id, syncedFields);
      }
    });
    tx();

    const updated = getOrganizationSettingsRow(db, user.organization_id);
    return NextResponse.json({ project_types: normalizeProjectTypeDefinitionsRow(updated) });
  } catch (err) {
    console.error('PUT /api/project-types failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
