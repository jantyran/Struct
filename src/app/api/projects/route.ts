import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { requireSession } from '@/lib/auth';
import { normalizeProjectTypeDefinitionsRow } from '@/lib/project-types';
import { persistProjectCustomFields, syncCustomFieldsWithDefinition } from '@/lib/project-field-sync';
import { hasSystemPermission } from '@/lib/permissions';
import type { CustomField } from '@/types';
import { getOrganizationSettingsRow } from '@/lib/organization-settings';

export async function GET() {
  try {
    const user = await requireSession();
    const db = getDb();

    const canViewAll = hasSystemPermission(db, user.id, 'view_all_projects') || hasSystemPermission(db, user.id, 'edit_all_projects');
    const projects = canViewAll
      ? db.prepare('SELECT * FROM projects WHERE organization_id = ? ORDER BY updated_at DESC').all(user.organization_id)
      : db.prepare(`
          SELECT DISTINCT p.* FROM projects p
          LEFT JOIN project_members m ON p.id = m.project_id
          WHERE p.organization_id = ? AND (p.owner_id = ? OR m.user_id = ?)
          ORDER BY p.updated_at DESC
        `).all(user.organization_id, user.id, user.id);

    return NextResponse.json(projects);
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSession();
    const db = getDb();
    const body = await request.json() as {
      name: string;
      type?: string;
      phase_key?: string;
      custom_fields?: Array<{
        id?: string;
        template_id?: string;
        key: string;
        label: string;
        type: string;
        value?: string;
        options?: string;
        layout?: 'half' | 'full';
        inherited?: number;
        inherited_from?: string | null;
        sort_order?: number;
        is_builtin?: number;
        section?: string;
      }>;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'name は必須です' }, { status: 400 });
    }

    const id = uuidv4();
    const tx = db.transaction(() => {
      const settingsRow = getOrganizationSettingsRow(db, user.organization_id);
      const definitions = normalizeProjectTypeDefinitionsRow(settingsRow);
      const currentDefinition = definitions.find((definition) => definition.key === (body.type ?? 'campaign'));

      db.prepare(`
        INSERT INTO projects (id, name, type, phase_key, organization_id, owner_id, primary_assignee_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        body.name.trim(),
        body.type ?? 'campaign',
        body.phase_key ?? '',
        user.organization_id,
        user.id,
        user.id
      );

      const incomingFields = (body.custom_fields ?? []).map((field, index) => ({
        id: field.id ?? uuidv4(),
        project_id: id,
        template_id: field.template_id ?? undefined,
        key: field.key,
        label: field.label,
        type: field.type as CustomField['type'],
        value: field.value ?? '',
        options: field.options ?? '{}',
        layout: field.layout === 'full' ? 'full' : 'half',
        inherited: field.inherited ?? 0,
        inherited_from: field.inherited_from ?? null,
        crawled_content: null,
        sort_order: field.sort_order ?? index,
        is_builtin: field.is_builtin ?? 0,
        section: field.section ?? '',
      })) as CustomField[];

      const syncedFields = syncCustomFieldsWithDefinition(id, incomingFields, currentDefinition);
      persistProjectCustomFields(db, id, syncedFields);
    });
    tx();

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
