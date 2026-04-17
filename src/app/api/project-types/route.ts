import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { normalizeProjectTypeDefinitions, normalizeProjectTypeDefinitionsRow, serializeProjectTypeDefinitions } from '@/lib/project-types';
import { persistProjectCustomFields, syncCustomFieldsWithDefinition } from '@/lib/project-field-sync';
import type { CustomField } from '@/types';
import { DEFAULT_ORGANIZATION_SCOPE, getOrganizationSettingsRow } from '@/lib/organization-settings';
import { hasSystemPermission } from '@/lib/permissions';

export async function GET() {
  try {
    await requireSession();
    const db = getDb();
    const assets = getOrganizationSettingsRow(db);
    return NextResponse.json({ project_types: normalizeProjectTypeDefinitionsRow(assets) });
  } catch (err) {
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
    const body = await request.json() as { project_types?: unknown };
    const definitions = normalizeProjectTypeDefinitions(body.project_types as any[]);
    getOrganizationSettingsRow(db);

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE organization_settings SET
          project_types = ?,
          updated_at = datetime('now')
        WHERE scope_key = ?
      `).run(serializeProjectTypeDefinitions(definitions), DEFAULT_ORGANIZATION_SCOPE);

      const projects = db.prepare('SELECT id, type FROM projects').all() as Array<{ id: string; type: string }>;
      for (const project of projects) {
        const existingFields = db.prepare('SELECT * FROM custom_fields WHERE project_id = ? ORDER BY sort_order ASC').all(project.id) as CustomField[];
        const definition = definitions.find((item) => item.key === project.type);
        const syncedFields = syncCustomFieldsWithDefinition(project.id, existingFields, definition);
        persistProjectCustomFields(db, project.id, syncedFields);
      }
    });
    tx();

    const updated = getOrganizationSettingsRow(db);
    return NextResponse.json({ project_types: normalizeProjectTypeDefinitionsRow(updated) });
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
