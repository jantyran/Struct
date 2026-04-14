import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { normalizeProjectTypeDefinitionsRow } from '@/lib/project-types';
import { persistProjectCustomFields, syncCustomFieldsWithDefinition } from '@/lib/project-field-sync';
import type { CustomField } from '@/types';

interface Params { params: { id: string } }

async function checkProjectAccess(projectId: string, userId: string) {
  const db = getDb();
  return db.prepare(`
    SELECT DISTINCT p.* FROM projects p
    LEFT JOIN project_members m ON p.id = m.project_id
    WHERE p.id = ? AND (p.owner_id = ? OR m.user_id = ?)
  `).get(projectId, userId, userId);
}

export async function GET(_req: Request, { params }: Params) {
  let user;
  try {
    user = await requireSession();
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();

    const project = db.prepare(`
      SELECT p.* FROM projects p
      LEFT JOIN project_members m ON p.id = m.project_id
      WHERE p.id = ? AND (p.owner_id = ? OR m.user_id = ?)
    `).get(params.id, user.id, user.id) as any;

    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const fields = db.prepare('SELECT * FROM custom_fields WHERE project_id = ? ORDER BY sort_order ASC').all(params.id) as CustomField[];
    const settingsRow = db.prepare('SELECT * FROM global_assets WHERE user_id = ?').get(project.owner_id) as any;
    const definitions = normalizeProjectTypeDefinitionsRow(settingsRow);
    const currentDefinition = definitions.find((definition) => definition.key === project.type);
    const syncedFields = syncCustomFieldsWithDefinition(params.id, fields, currentDefinition);

    const members = db.prepare(`
      SELECT m.*, u.email, u.name FROM project_members m
      JOIN users u ON m.user_id = u.id
      WHERE m.project_id = ?
    `).all(params.id);
    const invitations = db.prepare("SELECT * FROM invitations WHERE project_id = ? AND status = 'PENDING'").all(params.id);

    return NextResponse.json({
      ...project,
      custom_fields: syncedFields,
      members: members.map((m: any) => ({ user: { email: m.email, name: m.name }, role: m.role })),
      invitations
    });
  } catch (err) {
    console.error('GET /api/projects/[id] failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await requireSession();
    const db = getDb();
    const projectAccess = await checkProjectAccess(params.id, user.id);
    if (!projectAccess) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as {
      name?: string;
      type?: string;
      phase_key?: string;
      status?: string;
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
        crawled_content?: string | null;
        sort_order?: number;
        is_builtin?: number;
        section?: string;
      }>;
    };

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE projects SET
          name = COALESCE(?, name),
          type = COALESCE(?, type),
          phase_key = COALESCE(?, phase_key),
          status = COALESCE(?, status),
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        body.name ?? null,
        body.type ?? null,
        body.phase_key ?? null,
        body.status ?? null,
        params.id
      );

      if (body.custom_fields) {
        const settingsRow = db.prepare('SELECT * FROM global_assets WHERE user_id = ?').get((projectAccess as any).owner_id) as any;
        const definitions = normalizeProjectTypeDefinitionsRow(settingsRow);
        const currentDefinition = definitions.find((definition) => definition.key === (body.type ?? (projectAccess as any).type));
        const incomingFields = body.custom_fields.map((f, idx) => ({
          id: f.id ?? uuidv4(),
          project_id: params.id,
          template_id: f.template_id ?? undefined,
          key: f.key,
          label: f.label,
          type: f.type as CustomField['type'],
          value: f.value ?? '',
          options: f.options ?? '{}',
          layout: f.layout === 'full' ? 'full' : 'half',
          inherited: f.inherited ?? 0,
          inherited_from: f.inherited_from ?? null,
          crawled_content: f.crawled_content ?? null,
          sort_order: f.sort_order ?? idx,
          is_builtin: f.is_builtin ?? 0,
          section: f.section ?? '',
        })) as CustomField[];
        const syncedFields = syncCustomFieldsWithDefinition(params.id, incomingFields, currentDefinition);
        persistProjectCustomFields(db, params.id, syncedFields);
      }
    });
    tx();

    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.id);
    const fields = db.prepare('SELECT * FROM custom_fields WHERE project_id = ? ORDER BY sort_order ASC').all(params.id);
    return NextResponse.json({ ...updated as any, custom_fields: fields });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireSession();
    const db = getDb();
    const project = db.prepare('SELECT owner_id FROM projects WHERE id = ?').get(params.id) as any;
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (project.owner_id !== user.id) return NextResponse.json({ error: 'Only owners can delete projects' }, { status: 403 });

    db.prepare('DELETE FROM projects WHERE id = ?').run(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
