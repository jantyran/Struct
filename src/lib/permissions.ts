import type Database from 'better-sqlite3';

export const SYSTEM_PERMISSION_KEYS = [
  'manage_users',
  'manage_system_roles',
  'manage_project_roles',
  'manage_project_settings',
  'manage_global_assets',
  'manage_ai_settings',
  'view_all_projects',
  'edit_all_projects',
  'delete_any_project',
] as const;

export type SystemPermissionKey = typeof SYSTEM_PERMISSION_KEYS[number];
export type SystemPermissions = Record<SystemPermissionKey, boolean>;

export const ALL_SYSTEM_PERMISSIONS = SYSTEM_PERMISSION_KEYS.reduce((acc, key) => {
  acc[key] = true;
  return acc;
}, {} as SystemPermissions);

export const DEFAULT_SYSTEM_ROLES = [
  {
    key: 'SYSTEM_ADMIN',
    name: 'システム管理者',
    description: 'ユーザー、ロール、全プロジェクト、全設定を管理できます。',
    permissions: { ...ALL_SYSTEM_PERMISSIONS },
  },
  {
    key: 'MANAGER',
    name: 'マネージャー',
    description: '全プロジェクトの閲覧・編集と主要設定を管理できます。',
    permissions: {
      manage_users: false,
      manage_system_roles: false,
      manage_project_roles: true,
      manage_project_settings: true,
      manage_global_assets: true,
      manage_ai_settings: true,
      view_all_projects: true,
      edit_all_projects: true,
      delete_any_project: false,
    },
  },
  {
    key: 'USER',
    name: '一般ユーザー',
    description: '自分が所有または参加しているプロジェクトを利用できます。',
    permissions: {
      manage_users: false,
      manage_system_roles: false,
      manage_project_roles: false,
      manage_project_settings: false,
      manage_global_assets: false,
      manage_ai_settings: false,
      view_all_projects: false,
      edit_all_projects: false,
      delete_any_project: false,
    },
  },
] as const;

export const PROJECT_MEMBER_ROLES = [
  {
    key: 'PROJECT_MANAGER',
    name: 'プロジェクト管理者',
    description: 'プロジェクト内の編集とメンバー管理ができます。',
    permissions: {
      can_view: true,
      can_edit: true,
      can_manage_members: true,
      can_delete: false,
      can_view_items: true,
      can_edit_items: true,
      can_view_content: true,
      can_generate_content: true,
      can_view_notes: true,
      can_edit_notes: true,
    },
  },
  {
    key: 'MEMBER',
    name: 'メンバー',
    description: 'プロジェクト内の編集ができます。',
    permissions: {
      can_view: true,
      can_edit: true,
      can_manage_members: false,
      can_delete: false,
      can_view_items: true,
      can_edit_items: true,
      can_view_content: true,
      can_generate_content: true,
      can_view_notes: true,
      can_edit_notes: true,
    },
  },
  {
    key: 'GUEST',
    name: 'ゲスト',
    description: 'プロジェクトを閲覧できます。',
    permissions: {
      can_view: true,
      can_edit: false,
      can_manage_members: false,
      can_delete: false,
      can_view_items: true,
      can_edit_items: false,
      can_view_content: true,
      can_generate_content: false,
      can_view_notes: true,
      can_edit_notes: false,
    },
  },
] as const;

export const PROJECT_PERMISSION_KEYS = [
  'can_view',
  'can_edit',
  'can_manage_members',
  'can_delete',
  'can_view_items',
  'can_edit_items',
  'can_view_content',
  'can_generate_content',
  'can_view_notes',
  'can_edit_notes',
] as const;

export type ProjectRolePermissionKey = typeof PROJECT_PERMISSION_KEYS[number];
export type ProjectRolePermissions = Record<ProjectRolePermissionKey, boolean>;

export function normalizeSystemPermissions(input: unknown): SystemPermissions {
  const source = typeof input === 'object' && input !== null ? input as Record<string, unknown> : {};
  return SYSTEM_PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = Boolean(source[key]);
    return acc;
  }, {} as SystemPermissions);
}

export function parseSystemPermissions(json: string | null | undefined): SystemPermissions {
  try {
    return normalizeSystemPermissions(JSON.parse(json || '{}'));
  } catch {
    return normalizeSystemPermissions({});
  }
}

export function seedSystemRoles(db: Database.Database) {
  const existing = db.prepare('SELECT COUNT(*) as count FROM system_role_definitions').get() as { count: number };
  if (existing.count === 0) {
    DEFAULT_SYSTEM_ROLES.forEach((role, index) => {
      db.prepare(`
        INSERT INTO system_role_definitions (id, key, name, description, permissions, is_system, sort_order)
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `).run(
        role.key,
        role.key,
        role.name,
        role.description,
        JSON.stringify(role.permissions),
        index,
      );
    });
  }

  const firstAdmin = db.prepare("SELECT 1 FROM users WHERE system_role = 'SYSTEM_ADMIN' LIMIT 1").get();
  if (!firstAdmin) {
    const firstUser = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get() as { id: string } | undefined;
    if (firstUser) db.prepare("UPDATE users SET system_role = 'SYSTEM_ADMIN' WHERE id = ?").run(firstUser.id);
  }
}

export function normalizeProjectRolePermissions(input: unknown): ProjectRolePermissions {
  const source = typeof input === 'object' && input !== null ? input as Record<string, unknown> : {};
  return PROJECT_PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = Boolean(source[key]);
    return acc;
  }, {} as ProjectRolePermissions);
}

export function parseProjectRolePermissions(json: string | null | undefined): ProjectRolePermissions {
  try {
    return normalizeProjectRolePermissions(JSON.parse(json || '{}'));
  } catch {
    return normalizeProjectRolePermissions({});
  }
}

export function seedProjectRoles(db: Database.Database) {
  const existing = db.prepare('SELECT COUNT(*) as count FROM project_role_definitions').get() as { count: number };
  if (existing.count > 0) return;

  PROJECT_MEMBER_ROLES.forEach((role, index) => {
    db.prepare(`
      INSERT INTO project_role_definitions (id, key, name, description, permissions, is_system, sort_order)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(
      role.key,
      role.key,
      role.name,
      role.description,
      JSON.stringify(role.permissions),
      index,
    );
  });
}

export function projectRoleDefinitions(db: Database.Database) {
  seedProjectRoles(db);
  return db.prepare(`
    SELECT id, key, name, description, permissions, is_system, sort_order
    FROM project_role_definitions
    ORDER BY sort_order ASC, created_at ASC
  `).all().map((role: any) => ({
    ...role,
    permissions: parseProjectRolePermissions(role.permissions),
    is_system: role.is_system === 1,
  }));
}

export function projectRoleExists(db: Database.Database, roleKey: string) {
  seedProjectRoles(db);
  return Boolean(db.prepare('SELECT 1 FROM project_role_definitions WHERE key = ?').get(roleKey));
}

export function systemRoleDefinitions(db: Database.Database) {
  seedSystemRoles(db);
  return db.prepare(`
    SELECT id, key, name, description, permissions, is_system, sort_order
    FROM system_role_definitions
    ORDER BY sort_order ASC, created_at ASC
  `).all().map((role: any) => ({
    ...role,
    permissions: parseSystemPermissions(role.permissions),
    is_system: role.is_system === 1,
  }));
}

export function systemRoleExists(db: Database.Database, roleKey: string) {
  seedSystemRoles(db);
  return Boolean(db.prepare('SELECT 1 FROM system_role_definitions WHERE key = ?').get(roleKey));
}

export function systemPermissionsForUser(db: Database.Database, userId: string): SystemPermissions {
  seedSystemRoles(db);
  const row = db.prepare(`
    SELECT rd.permissions
    FROM users u
    LEFT JOIN system_role_definitions rd ON rd.key = u.system_role
    WHERE u.id = ?
  `).get(userId) as { permissions?: string | null } | undefined;
  return parseSystemPermissions(row?.permissions);
}

export function hasSystemPermission(db: Database.Database, userId: string, permission: SystemPermissionKey) {
  return Boolean(systemPermissionsForUser(db, userId)[permission]);
}

export function normalizeProjectMemberRole(role: unknown) {
  const value = typeof role === 'string' ? role.trim().toUpperCase() : '';
  return value || 'MEMBER';
}

export function projectAccessForUser(db: Database.Database, projectId: string, userId: string) {
  const systemPermissions = systemPermissionsForUser(db, userId);
  const userRow = db.prepare('SELECT organization_id FROM users WHERE id = ?').get(userId) as { organization_id?: string | null } | undefined;
  const row = db.prepare(`
    SELECT p.owner_id, p.organization_id, m.role, pr.permissions AS project_role_permissions
    FROM projects p
    LEFT JOIN project_members m ON p.id = m.project_id AND m.user_id = ?
    LEFT JOIN project_role_definitions pr ON pr.key = m.role
    WHERE p.id = ?
  `).get(userId, projectId) as { owner_id: string; organization_id?: string | null; role?: string | null; project_role_permissions?: string | null } | undefined;

  if (!row) return null;
  if (userRow?.organization_id && row.organization_id && row.organization_id !== userRow.organization_id) return null;
  const isOwner = row.owner_id === userId;
  const isMember = Boolean(row.role);
  const projectPermissions = parseProjectRolePermissions(row.project_role_permissions);
  const canView = isOwner || (isMember && projectPermissions.can_view) || systemPermissions.view_all_projects || systemPermissions.edit_all_projects;
  const canEdit = isOwner || (isMember && projectPermissions.can_edit) || systemPermissions.edit_all_projects;
  const canManageMembers = isOwner || (isMember && projectPermissions.can_manage_members) || systemPermissions.edit_all_projects;
  const canDelete = isOwner || systemPermissions.delete_any_project;

  return {
    is_owner: isOwner,
    project_role: isOwner ? 'OWNER' : row.role ?? null,
    system_permissions: systemPermissions,
    can_view: canView,
    can_edit: canEdit,
    can_manage_members: canManageMembers,
    can_delete: canDelete,
    can_view_items: isOwner || (isMember && projectPermissions.can_view_items) || systemPermissions.view_all_projects || systemPermissions.edit_all_projects,
    can_edit_items: isOwner || (isMember && projectPermissions.can_edit_items) || systemPermissions.edit_all_projects,
    can_view_content: isOwner || (isMember && projectPermissions.can_view_content) || systemPermissions.view_all_projects || systemPermissions.edit_all_projects,
    can_generate_content: isOwner || (isMember && projectPermissions.can_generate_content) || systemPermissions.edit_all_projects,
    can_view_notes: isOwner || (isMember && projectPermissions.can_view_notes) || systemPermissions.view_all_projects || systemPermissions.edit_all_projects,
    can_edit_notes: isOwner || (isMember && projectPermissions.can_edit_notes) || systemPermissions.edit_all_projects,
  };
}

type ProjectPermissionKey =
  | 'view_project'
  | 'edit_project'
  | 'view_items'
  | 'edit_items'
  | 'view_content'
  | 'generate_content'
  | 'view_notes'
  | 'edit_notes'
  | 'manage_members'
  | 'delete_project';

export function requireProjectPermission(db: Database.Database, projectId: string, userId: string, permission: ProjectPermissionKey) {
  const access = projectAccessForUser(db, projectId, userId);
  if (!access) return false;
  switch (permission) {
    case 'view_project': return access.can_view;
    case 'edit_project': return access.can_edit;
    case 'view_items': return access.can_view_items;
    case 'edit_items': return access.can_edit_items;
    case 'view_content': return access.can_view_content;
    case 'generate_content': return access.can_generate_content;
    case 'view_notes': return access.can_view_notes;
    case 'edit_notes': return access.can_edit_notes;
    case 'manage_members': return access.can_manage_members;
    case 'delete_project': return access.can_delete;
    default: return false;
  }
}
