import type Database from 'better-sqlite3';
import { requireProjectPermission } from '@/lib/permissions';

const MAX_PROJECT_HIERARCHY_DEPTH = 5;

export interface ProjectRelationSummary {
  id: string;
  relation_id?: string;
  name: string;
  type: string;
  status: string;
  phase_key: string;
  parent_project_id: string | null;
  primary_assignee_id: string | null;
  primary_assignee: { id: string; name: string | null; email: string; avatar_url?: string | null } | null;
  todo_total: number;
  todo_done: number;
  todo_overdue: number;
  completion_rate: number;
}

export interface ProjectRelationsPayload {
  parent: ProjectRelationSummary | null;
  children: ProjectRelationSummary[];
  related: ProjectRelationSummary[];
  available_projects: Array<Pick<ProjectRelationSummary, 'id' | 'name' | 'type' | 'status' | 'phase_key' | 'parent_project_id'>>;
  rollup: {
    visible_children: number;
    visible_related: number;
    completed_children: number;
    todo_total: number;
    todo_done: number;
    todo_overdue: number;
    completion_rate: number;
  };
}

interface ProjectRow {
  id: string;
  name: string;
  type: string;
  status: string;
  phase_key: string | null;
  organization_id: string | null;
  parent_project_id: string | null;
  primary_assignee_id: string | null;
  primary_assignee_name?: string | null;
  primary_assignee_email?: string | null;
  primary_assignee_avatar_url?: string | null;
  relation_id?: string;
}

function todoSummary(db: Database.Database, projectId: string) {
  const row = db.prepare(`
    SELECT
      COUNT(*) AS todo_total,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS todo_done,
      SUM(CASE WHEN status <> 'done' AND due_date <> '' AND date(due_date) < date('now') THEN 1 ELSE 0 END) AS todo_overdue
    FROM todos
    WHERE project_id = ?
  `).get(projectId) as { todo_total: number; todo_done: number | null; todo_overdue: number | null };
  const total = Number(row.todo_total ?? 0);
  const done = Number(row.todo_done ?? 0);
  return {
    todo_total: total,
    todo_done: done,
    todo_overdue: Number(row.todo_overdue ?? 0),
    completion_rate: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

function toSummary(db: Database.Database, row: ProjectRow): ProjectRelationSummary {
  return {
    id: row.id,
    relation_id: row.relation_id,
    name: row.name,
    type: row.type,
    status: row.status,
    phase_key: row.phase_key ?? '',
    parent_project_id: row.parent_project_id ?? null,
    primary_assignee_id: row.primary_assignee_id ?? null,
    primary_assignee: row.primary_assignee_id
      ? {
          id: row.primary_assignee_id,
          name: row.primary_assignee_name ?? null,
          email: row.primary_assignee_email ?? '',
          avatar_url: row.primary_assignee_avatar_url ?? '',
        }
      : null,
    ...todoSummary(db, row.id),
  };
}

function projectSelectSql(whereClause: string, extraSelect = '') {
  return `
    SELECT
      p.id, p.name, p.type, p.status, p.phase_key, p.organization_id, p.parent_project_id, p.primary_assignee_id,
      p.created_at, p.updated_at,
      lead.name AS primary_assignee_name,
      lead.email AS primary_assignee_email,
      lead.avatar_url AS primary_assignee_avatar_url
      ${extraSelect}
    FROM projects p
    LEFT JOIN users lead ON p.primary_assignee_id = lead.id
    ${whereClause}
  `;
}

export function normalizeRelationPair(projectId: string, targetProjectId: string) {
  return projectId < targetProjectId
    ? { projectAId: projectId, projectBId: targetProjectId }
    : { projectAId: targetProjectId, projectBId: projectId };
}

export function getProjectOrganizationId(db: Database.Database, projectId: string) {
  const row = db.prepare('SELECT organization_id FROM projects WHERE id = ?').get(projectId) as { organization_id?: string | null } | undefined;
  return row?.organization_id ?? null;
}

export function getProjectRelations(db: Database.Database, projectId: string, userId: string): ProjectRelationsPayload | null {
  const current = db.prepare('SELECT id, parent_project_id, organization_id FROM projects WHERE id = ?').get(projectId) as { id: string; parent_project_id: string | null; organization_id: string | null } | undefined;
  if (!current) return null;
  if (!requireProjectPermission(db, projectId, userId, 'view_project')) return null;

  const parentRow = current.parent_project_id
    ? db.prepare(projectSelectSql('WHERE p.id = ?')).get(current.parent_project_id) as ProjectRow | undefined
    : undefined;
  const parent = parentRow && requireProjectPermission(db, parentRow.id, userId, 'view_project')
    ? toSummary(db, parentRow)
    : null;

  const childRows = db.prepare(`
    ${projectSelectSql('WHERE p.parent_project_id = ?')}
    ORDER BY p.status = 'completed' ASC, datetime(p.updated_at) DESC, p.name ASC
  `).all(projectId) as ProjectRow[];
  const children = childRows
    .filter((row) => requireProjectPermission(db, row.id, userId, 'view_project'))
    .map((row) => toSummary(db, row));

  const relatedRows = db.prepare(`
    ${projectSelectSql(`
      JOIN project_relations r ON
        (r.project_a_id = ? AND r.project_b_id = p.id) OR
        (r.project_b_id = ? AND r.project_a_id = p.id)
      WHERE p.organization_id = ?
    `, ', r.id AS relation_id')}
    ORDER BY datetime(p.updated_at) DESC, p.name ASC
  `).all(projectId, projectId, current.organization_id) as ProjectRow[];
  const related = relatedRows
    .filter((row) => requireProjectPermission(db, row.id, userId, 'view_project'))
    .map((row) => toSummary(db, row));

  const availableRows = db.prepare(`
    SELECT id, name, type, status, phase_key, parent_project_id
    FROM projects
    WHERE organization_id = ? AND id <> ?
    ORDER BY datetime(updated_at) DESC, name ASC
  `).all(current.organization_id, projectId) as Array<Pick<ProjectRelationSummary, 'id' | 'name' | 'type' | 'status' | 'phase_key' | 'parent_project_id'>>;
  const availableProjects = availableRows
    .filter((row) => requireProjectPermission(db, row.id, userId, 'view_project'))
    .map((row) => ({ ...row, phase_key: row.phase_key ?? '', parent_project_id: row.parent_project_id ?? null }));

  const rollupTodoTotal = children.reduce((sum, child) => sum + child.todo_total, 0);
  const rollupTodoDone = children.reduce((sum, child) => sum + child.todo_done, 0);

  return {
    parent,
    children,
    related,
    available_projects: availableProjects,
    rollup: {
      visible_children: children.length,
      visible_related: related.length,
      completed_children: children.filter((child) => child.status === 'completed').length,
      todo_total: rollupTodoTotal,
      todo_done: rollupTodoDone,
      todo_overdue: children.reduce((sum, child) => sum + child.todo_overdue, 0),
      completion_rate: rollupTodoTotal > 0 ? Math.round((rollupTodoDone / rollupTodoTotal) * 100) : 0,
    },
  };
}

export function validateParentChange(db: Database.Database, projectId: string, parentProjectId: string | null, userId: string) {
  if (!requireProjectPermission(db, projectId, userId, 'edit_project')) {
    return { ok: false as const, status: 403, error: '編集権限がありません' };
  }
  const project = db.prepare('SELECT id, organization_id FROM projects WHERE id = ?').get(projectId) as { id: string; organization_id: string | null } | undefined;
  if (!project) return { ok: false as const, status: 404, error: 'Not found' };
  if (!parentProjectId) return { ok: true as const };
  if (parentProjectId === projectId) return { ok: false as const, status: 400, error: '自分自身を親プロジェクトにはできません' };

  const parent = db.prepare('SELECT id, organization_id, parent_project_id FROM projects WHERE id = ?').get(parentProjectId) as { id: string; organization_id: string | null; parent_project_id: string | null } | undefined;
  if (!parent || parent.organization_id !== project.organization_id) {
    return { ok: false as const, status: 400, error: '親プロジェクトが見つかりません' };
  }
  if (!requireProjectPermission(db, parentProjectId, userId, 'view_project')) {
    return { ok: false as const, status: 400, error: '親プロジェクトが見つかりません' };
  }

  let depth = 1;
  let cursor: string | null = parent.parent_project_id;
  const seen = new Set<string>([projectId, parentProjectId]);
  while (cursor) {
    if (cursor === projectId || seen.has(cursor)) {
      return { ok: false as const, status: 400, error: '循環する親子関係は設定できません' };
    }
    seen.add(cursor);
    depth += 1;
    if (depth > MAX_PROJECT_HIERARCHY_DEPTH) {
      return { ok: false as const, status: 400, error: `プロジェクト階層は${MAX_PROJECT_HIERARCHY_DEPTH}階層までです` };
    }
    const ancestor = db.prepare('SELECT parent_project_id FROM projects WHERE id = ?').get(cursor) as { parent_project_id: string | null } | undefined;
    cursor = ancestor?.parent_project_id ?? null;
  }

  return { ok: true as const };
}

export function validateProjectRelation(db: Database.Database, projectId: string, targetProjectId: string, userId: string) {
  if (!requireProjectPermission(db, projectId, userId, 'edit_project')) {
    return { ok: false as const, status: 403, error: '編集権限がありません' };
  }
  if (projectId === targetProjectId) return { ok: false as const, status: 400, error: '自分自身は関連プロジェクトにできません' };
  const organizationId = getProjectOrganizationId(db, projectId);
  const targetOrganizationId = getProjectOrganizationId(db, targetProjectId);
  if (!organizationId || organizationId !== targetOrganizationId) {
    return { ok: false as const, status: 400, error: '関連プロジェクトが見つかりません' };
  }
  if (!requireProjectPermission(db, targetProjectId, userId, 'view_project')) {
    return { ok: false as const, status: 400, error: '関連プロジェクトが見つかりません' };
  }
  return { ok: true as const };
}
