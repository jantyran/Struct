import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { normalizeProjectTypeDefinitionsRow } from '@/lib/project-types';
import { persistProjectCustomFields, syncCustomFieldsWithDefinition } from '@/lib/project-field-sync';
import { requireProjectPermission } from '@/lib/permissions';
import { getOrganizationSettingsRow } from '@/lib/organization-settings';
import type { CustomField } from '@/types';

interface Params { params: Promise<{ id: string }> }

export async function POST(request: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  try {
    const user = await requireSession();
    const db = getDb();
    if (!requireProjectPermission(db, params.id, user.id, 'edit_project')) {
      return NextResponse.json({ error: '編集権限がありません' }, { status: 403 });
    }

    const parent = db.prepare('SELECT id, organization_id FROM projects WHERE id = ?').get(params.id) as { id: string; organization_id: string | null } | undefined;
    if (!parent || parent.organization_id !== user.organization_id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json() as {
      name?: string;
      type?: string;
      phase_key?: string;
      primary_assignee_id?: string | null;
    };
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: 'プロジェクト名は必須です' }, { status: 400 });

    const primaryAssigneeId = body.primary_assignee_id?.trim() || user.id;
    const assignee = db.prepare(`
      SELECT id FROM users
      WHERE id = ? AND organization_id = ?
    `).get(primaryAssigneeId, user.organization_id);
    if (!assignee) return NextResponse.json({ error: '主担当が見つかりません' }, { status: 400 });

    const id = uuidv4();
    const type = body.type?.trim() || 'campaign';
    const phaseKey = body.phase_key?.trim() || '';

    const tx = db.transaction(() => {
      const settingsRow = getOrganizationSettingsRow(db, user.organization_id);
      const definitions = normalizeProjectTypeDefinitionsRow(settingsRow);
      const currentDefinition = definitions.find((definition) => definition.key === type);

      db.prepare(`
        INSERT INTO projects (id, name, type, phase_key, organization_id, owner_id, primary_assignee_id, parent_project_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, name, type, phaseKey, user.organization_id, user.id, primaryAssigneeId, params.id);

      const syncedFields = syncCustomFieldsWithDefinition(id, [] as CustomField[], currentDefinition);
      persistProjectCustomFields(db, id, syncedFields);
    });
    tx();

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
