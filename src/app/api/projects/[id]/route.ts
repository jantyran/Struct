import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthSession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { normalizeProjectTypeDefinitionsRow } from '@/lib/project-types';
import { persistProjectCustomFields, syncCustomFieldsWithDefinition } from '@/lib/project-field-sync';
import { projectAccessForUser, projectRoleDefinitions, requireProjectPermission } from '@/lib/permissions';
import type { CustomField, Project } from '@/types';
import { getOrganizationSettingsRow } from '@/lib/organization-settings';
import { normalizeGlobalAssetsRow } from '@/lib/global-assets';

type ProjectRow = Project & {
  owner_email: string; owner_name: string; owner_avatar_url: string | null;
  primary_assignee_email: string | null; primary_assignee_name: string | null; primary_assignee_avatar_url: string | null;
};
type MemberRow = { id: string; user_id: string; email: string; name: string; avatar_url: string | null; role: string };

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  const { user, errorResponse } = await getAuthSession();
  if (errorResponse) return errorResponse;

  try {
    const db = getDb();

    const project = db.prepare(`
      SELECT p.*, owner.email AS owner_email, owner.name AS owner_name, owner.avatar_url AS owner_avatar_url,
        lead.email AS primary_assignee_email, lead.name AS primary_assignee_name, lead.avatar_url AS primary_assignee_avatar_url
      FROM projects p
      JOIN users owner ON p.owner_id = owner.id
      LEFT JOIN users lead ON p.primary_assignee_id = lead.id
      WHERE p.id = ? AND p.organization_id = ?
    `).get(params.id, user.organization_id) as ProjectRow | undefined;

    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const currentPermissions = projectAccessForUser(db, params.id, user.id);
    if (!currentPermissions?.can_view) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const fields = db.prepare('SELECT * FROM custom_fields WHERE project_id = ? ORDER BY sort_order ASC').all(params.id) as CustomField[];
    const settingsRow = getOrganizationSettingsRow(db, user.organization_id);
    const definitions = normalizeProjectTypeDefinitionsRow(settingsRow);
    const currentDefinition = definitions.find((definition) => definition.key === project.type);
    const syncedFields = syncCustomFieldsWithDefinition(params.id, fields, currentDefinition);

    const members = db.prepare(`
      SELECT m.*, u.email, u.name, u.avatar_url FROM project_members m
      JOIN users u ON m.user_id = u.id
      WHERE m.project_id = ?
    `).all(params.id);
    const contacts = db.prepare(`
      SELECT id, name, email, phone, company_name, created_at, updated_at
      FROM project_contacts
      WHERE project_id = ?
      ORDER BY datetime(created_at) ASC, rowid ASC
    `).all(params.id);
    const invitations = db.prepare("SELECT * FROM invitations WHERE project_id = ? AND status = 'PENDING'").all(params.id);
    const registeredUsers = currentPermissions.can_manage_members
      ? db.prepare(`
          SELECT id, email, name, avatar_url
          FROM users
          WHERE organization_id = ?
          ORDER BY COALESCE(NULLIF(name, ''), email) ASC
        `).all(user.organization_id)
      : [];
    const assignableUsers = [
      { id: project.owner_id, email: project.owner_email, name: project.owner_name, avatar_url: project.owner_avatar_url },
      ...members.map((m) => { const row = m as MemberRow; return { id: row.user_id, email: row.email, name: row.name, avatar_url: row.avatar_url }; }),
    ];

    return NextResponse.json({
      ...project,
      custom_fields: currentPermissions.can_view_items ? syncedFields : [],
      current_project_type_definition: currentDefinition ?? null,
      global_asset_objects: normalizeGlobalAssetsRow(settingsRow).objects,
      owner: { id: project.owner_id, email: project.owner_email, name: project.owner_name, avatar_url: project.owner_avatar_url },
      primary_assignee: project.primary_assignee_id
        ? {
            id: project.primary_assignee_id,
            email: project.primary_assignee_email,
            name: project.primary_assignee_name,
            avatar_url: project.primary_assignee_avatar_url,
          }
        : null,
      members: members.map((m) => {
        const row = m as MemberRow;
        return { id: row.id, user: { id: row.user_id, email: row.email, name: row.name, avatar_url: row.avatar_url }, role: row.role };
      }),
      contacts,
      invitations,
      assignable_users: assignableUsers,
      registered_users: registeredUsers,
      project_role_definitions: projectRoleDefinitions(db),
      current_permissions: currentPermissions,
    });
  } catch (err) {
    console.error('GET /api/projects/[id] failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  const { user, errorResponse } = await getAuthSession();
  if (errorResponse) return errorResponse;

  try {
    const db = getDb();
    const currentPermissions = projectAccessForUser(db, params.id, user);
    if (!currentPermissions) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!currentPermissions.can_edit) return NextResponse.json({ error: '編集権限がありません' }, { status: 403 });
    const existingProject = db.prepare('SELECT type, status, primary_assignee_id FROM projects WHERE id = ?').get(params.id) as { type: string; status: string; primary_assignee_id: string | null } | undefined;

    const body = await request.json() as {
      name?: string;
      type?: string;
      phase_key?: string;
      status?: string;
      primary_assignee_id?: string | null;
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
    const nextPrimaryAssigneeId = body.primary_assignee_id === undefined
      ? existingProject?.primary_assignee_id ?? null
      : body.primary_assignee_id;
    const currentStatus = existingProject?.status ?? 'draft';
    const nextStatus = body.status ?? currentStatus;
    const shouldMarkCompleted = nextStatus === 'completed' && currentStatus !== 'completed';
    const shouldClearCompleted = nextStatus !== 'completed';

    if (nextPrimaryAssigneeId) {
      const assignable = db.prepare(`
        SELECT 1 FROM projects p
        LEFT JOIN project_members m ON p.id = m.project_id AND m.user_id = ?
        WHERE p.id = ? AND p.organization_id = ? AND (p.owner_id = ? OR m.user_id = ?)
      `).get(nextPrimaryAssigneeId, params.id, user.organization_id, nextPrimaryAssigneeId, nextPrimaryAssigneeId);
      if (!assignable) {
        return NextResponse.json({ error: '主担当はプロジェクトメンバーから選択してください' }, { status: 400 });
      }
    }

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE projects SET
          name = COALESCE(?, name),
          type = COALESCE(?, type),
          phase_key = COALESCE(?, phase_key),
          status = COALESCE(?, status),
          primary_assignee_id = ?,
          completed_at = CASE
            WHEN ? THEN datetime('now')
            WHEN ? THEN NULL
            ELSE completed_at
          END,
          completed_by = CASE
            WHEN ? THEN ?
            WHEN ? THEN NULL
            ELSE completed_by
          END,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        body.name ?? null,
        body.type ?? null,
        body.phase_key ?? null,
        nextStatus,
        nextPrimaryAssigneeId,
        shouldMarkCompleted ? 1 : 0,
        shouldClearCompleted ? 1 : 0,
        shouldMarkCompleted ? 1 : 0,
        user.id,
        shouldClearCompleted ? 1 : 0,
        params.id
      );

      if (body.custom_fields) {
        if (!currentPermissions.can_edit_items) throw new Error('NO_ITEM_EDIT_PERMISSION');
        const settingsRow = getOrganizationSettingsRow(db, user.organization_id);
        const definitions = normalizeProjectTypeDefinitionsRow(settingsRow);
        const currentDefinition = definitions.find((definition) => definition.key === (body.type ?? existingProject?.type));
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
    return NextResponse.json({ ...(updated as Project), custom_fields: fields });
  } catch (err) {
    if ((err as Error).message === 'NO_ITEM_EDIT_PERMISSION') {
      return NextResponse.json({ error: '項目編集権限がありません' }, { status: 403 });
    }
    console.error('PATCH /api/projects/[id] failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  const { user, errorResponse } = await getAuthSession();
  if (errorResponse) return errorResponse;

  const db = getDb();
  const project = db.prepare('SELECT owner_id FROM projects WHERE id = ? AND organization_id = ?').get(params.id, user.organization_id) as { owner_id: string } | undefined;
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!requireProjectPermission(db, params.id, user, 'delete_project')) return NextResponse.json({ error: '削除権限がありません' }, { status: 403 });

  try {
    db.prepare('DELETE FROM projects WHERE id = ?').run(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/projects/[id] failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
