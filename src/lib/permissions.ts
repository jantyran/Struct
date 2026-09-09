import type Database from 'better-sqlite3';

type RoleRow = { id: string; key: string; name: string; description: string; permissions: string; is_system: number; sort_order: number };

export const SYSTEM_PERMISSION_KEYS = [
  'manage_organization_settings',
  'manage_users',
  'manage_teams',
  'manage_system_roles',
  'manage_project_roles',
  'manage_project_settings',
  'manage_master_data',
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
      manage_organization_settings: true,
      manage_users: false,
      manage_teams: true,
      manage_system_roles: false,
      manage_project_roles: true,
      manage_project_settings: true,
      manage_master_data: true,
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
      manage_organization_settings: false,
      manage_users: false,
      manage_teams: false,
      manage_system_roles: false,
      manage_project_roles: false,
      manage_project_settings: false,
      manage_master_data: false,
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

  // 既存の SYSTEM_ADMIN / MANAGER ロールに manage_teams が未反映であれば付与
  const adminRole = db.prepare("SELECT id, permissions FROM system_role_definitions WHERE key = 'SYSTEM_ADMIN'").get() as { id: string; permissions: string } | undefined;
  if (adminRole) {
    const perms = parseSystemPermissions(adminRole.permissions);
    if (!perms.manage_teams) {
      perms.manage_teams = true;
      db.prepare("UPDATE system_role_definitions SET permissions = ? WHERE id = ?").run(JSON.stringify(perms), adminRole.id);
    }
  }
  const managerRole = db.prepare("SELECT id, permissions FROM system_role_definitions WHERE key = 'MANAGER'").get() as { id: string; permissions: string } | undefined;
  if (managerRole) {
    const perms = parseSystemPermissions(managerRole.permissions);
    if (!perms.manage_teams) {
      perms.manage_teams = true;
      db.prepare("UPDATE system_role_definitions SET permissions = ? WHERE id = ?").run(JSON.stringify(perms), managerRole.id);
    }
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

let rolesSeeded = false;
export function ensureRolesSeeded(db: Database.Database) {
  if (rolesSeeded) return;
  seedSystemRoles(db);
  seedProjectRoles(db);
  rolesSeeded = true;
}

export function projectRoleDefinitions(db: Database.Database) {
  ensureRolesSeeded(db);
  return db.prepare(`
    SELECT id, key, name, description, permissions, is_system, sort_order
    FROM project_role_definitions
    ORDER BY sort_order ASC, created_at ASC
  `).all().map((role) => {
    const r = role as RoleRow;
    return { ...r, permissions: parseProjectRolePermissions(r.permissions), is_system: r.is_system === 1 };
  });
}

export function projectRoleExists(db: Database.Database, roleKey: string) {
  ensureRolesSeeded(db);
  return Boolean(db.prepare('SELECT 1 FROM project_role_definitions WHERE key = ?').get(roleKey));
}

export function systemRoleDefinitions(db: Database.Database) {
  ensureRolesSeeded(db);
  return db.prepare(`
    SELECT id, key, name, description, permissions, is_system, sort_order
    FROM system_role_definitions
    ORDER BY sort_order ASC, created_at ASC
  `).all().map((role) => {
    const r = role as RoleRow;
    return { ...r, permissions: parseSystemPermissions(r.permissions), is_system: r.is_system === 1 };
  });
}

export function systemRoleExists(db: Database.Database, roleKey: string) {
  ensureRolesSeeded(db);
  return Boolean(db.prepare('SELECT 1 FROM system_role_definitions WHERE key = ?').get(roleKey));
}

export function systemPermissionsForUser(db: Database.Database, userId: string): SystemPermissions {
  const row = db.prepare(`
    SELECT rd.permissions
    FROM users u
    LEFT JOIN system_role_definitions rd ON rd.key = u.system_role
    WHERE u.id = ?
  `).get(userId) as { permissions?: string | null } | undefined;
  return parseSystemPermissions(row?.permissions);
}

export type UserContext = string | {
  id: string;
  organization_id?: string | null;
  system_permissions?: SystemPermissions;
};

export function hasSystemPermission(
  db: Database.Database,
  userOrId: UserContext,
  permission: SystemPermissionKey
) {
  if (typeof userOrId === 'object' && userOrId.system_permissions) {
    return Boolean(userOrId.system_permissions[permission]);
  }
  const userId = typeof userOrId === 'string' ? userOrId : userOrId.id;
  return Boolean(systemPermissionsForUser(db, userId)[permission]);
}

export function normalizeProjectMemberRole(role: unknown) {
  const value = typeof role === 'string' ? role.trim().toUpperCase() : '';
  return value || 'MEMBER';
}

export function projectAccessForUser(db: Database.Database, projectId: string, userOrId: UserContext) {
  const userId = typeof userOrId === 'string' ? userOrId : userOrId.id;
  let systemPermissions: SystemPermissions;
  let userOrgId: string | null | undefined;

  if (typeof userOrId === 'object' && userOrId.system_permissions) {
    systemPermissions = userOrId.system_permissions;
    userOrgId = userOrId.organization_id;
  } else {
    const userRow = db.prepare(`
      SELECT u.organization_id, rd.permissions
      FROM users u
      LEFT JOIN system_role_definitions rd ON rd.key = u.system_role
      WHERE u.id = ?
    `).get(userId) as { organization_id?: string | null; permissions?: string | null } | undefined;
    userOrgId = userRow?.organization_id;
    systemPermissions = parseSystemPermissions(userRow?.permissions);
  }

  const row = db.prepare(`
    SELECT p.owner_id, p.organization_id, p.visibility, p.team_id, m.role, pr.permissions AS project_role_permissions
    FROM projects p
    LEFT JOIN project_members m ON p.id = m.project_id AND m.user_id = ?
    LEFT JOIN project_role_definitions pr ON pr.key = m.role
    WHERE p.id = ?
  `).get(userId, projectId) as {
    owner_id: string;
    organization_id?: string | null;
    visibility?: string | null;
    team_id?: string | null;
    role?: string | null;
    project_role_permissions?: string | null;
  } | undefined;

  if (!row) return null;
  if (userOrgId && row.organization_id && row.organization_id !== userOrgId) return null;
  const isOwner = row.owner_id === userId;
  const isMember = Boolean(row.role);
  const projectPermissions = parseProjectRolePermissions(row.project_role_permissions);

  // チームメンバー判定
  let isTeamMember = false;
  if (row.team_id) {
    const tm = db.prepare('SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?').get(row.team_id, userId);
    isTeamMember = Boolean(tm);
  }

  // visibility: 'public' | 'team' | 'private'
  const visibility = row.visibility || 'public';
  const isPublicAllowed = visibility === 'public';
  const isTeamAllowed = visibility === 'team' && isTeamMember;

  const canView =
    isOwner ||
    (isMember && projectPermissions.can_view) ||
    systemPermissions.view_all_projects ||
    systemPermissions.edit_all_projects ||
    isTeamAllowed ||
    (visibility !== 'private' && isPublicAllowed);

  const canEdit = isOwner || (isMember && projectPermissions.can_edit) || systemPermissions.edit_all_projects;
  const canManageMembers = isOwner || (isMember && projectPermissions.can_manage_members) || systemPermissions.edit_all_projects;
  const canDelete = isOwner || systemPermissions.delete_any_project;

  const canViewItems =
    isOwner ||
    systemPermissions.view_all_projects ||
    systemPermissions.edit_all_projects ||
    (isMember ? projectPermissions.can_view_items : canView);

  const canEditItems =
    isOwner ||
    systemPermissions.edit_all_projects ||
    (isMember && projectPermissions.can_edit_items);

  const canViewContent =
    isOwner ||
    systemPermissions.view_all_projects ||
    systemPermissions.edit_all_projects ||
    (isMember ? projectPermissions.can_view_content : canView);

  const canGenerateContent =
    isOwner ||
    systemPermissions.edit_all_projects ||
    (isMember && projectPermissions.can_generate_content);

  const canViewNotes =
    isOwner ||
    systemPermissions.view_all_projects ||
    systemPermissions.edit_all_projects ||
    (isMember ? projectPermissions.can_view_notes : canView);

  const canEditNotes =
    isOwner ||
    systemPermissions.edit_all_projects ||
    (isMember && projectPermissions.can_edit_notes);

  return {
    is_owner: isOwner,
    project_role: isOwner ? 'OWNER' : row.role ?? null,
    system_permissions: systemPermissions,
    can_view: canView,
    can_edit: canEdit,
    can_manage_members: canManageMembers,
    can_delete: canDelete,
    can_view_items: canViewItems,
    can_edit_items: canEditItems,
    can_view_content: canViewContent,
    can_generate_content: canGenerateContent,
    can_view_notes: canViewNotes,
    can_edit_notes: canEditNotes,
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

export function requireProjectPermission(db: Database.Database, projectId: string, userOrId: UserContext, permission: ProjectPermissionKey) {
  const access = projectAccessForUser(db, projectId, userOrId);
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
