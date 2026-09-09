import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  seedSystemRoles,
  seedProjectRoles,
  projectAccessForUser,
  requireProjectPermission,
  hasSystemPermission,
} from './permissions';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      avatar_url TEXT DEFAULT '',
      organization_id TEXT,
      system_role TEXT DEFAULT 'USER',
      user_settings TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'campaign',
      phase_key TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      organization_id TEXT,
      owner_id TEXT NOT NULL,
      primary_assignee_id TEXT,
      visibility TEXT DEFAULT 'public',
      team_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'MEMBER',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'MEMBER',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(team_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS system_role_definitions (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      permissions TEXT NOT NULL DEFAULT '{}',
      is_system INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_role_definitions (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      permissions TEXT NOT NULL DEFAULT '{}',
      is_system INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  seedSystemRoles(db);
  seedProjectRoles(db);
  return db;
}

describe('Permissions & Project Access', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('grants full permissions to the project owner', () => {
    db.prepare('INSERT INTO users (id, email, password_hash, organization_id, system_role) VALUES (?, ?, ?, ?, ?)').run(
      'user-owner', 'owner@example.com', 'hash', 'org-1', 'USER'
    );
    db.prepare('INSERT INTO projects (id, name, owner_id, organization_id) VALUES (?, ?, ?, ?)').run(
      'proj-1', 'Test Project', 'user-owner', 'org-1'
    );

    const access = projectAccessForUser(db, 'proj-1', 'user-owner');
    expect(access).not.toBeNull();
    expect(access?.is_owner).toBe(true);
    expect(access?.can_view).toBe(true);
    expect(access?.can_edit).toBe(true);
    expect(access?.can_manage_members).toBe(true);
    expect(access?.can_delete).toBe(true);
    expect(access?.can_edit_items).toBe(true);
    expect(access?.can_edit_notes).toBe(true);
    expect(access?.can_generate_content).toBe(true);
  });

  it('respects GUEST project role limitations', () => {
    db.prepare('INSERT INTO users (id, email, password_hash, organization_id, system_role) VALUES (?, ?, ?, ?, ?)').run(
      'user-guest', 'guest@example.com', 'hash', 'org-1', 'USER'
    );
    db.prepare('INSERT INTO projects (id, name, owner_id, organization_id, visibility) VALUES (?, ?, ?, ?, ?)').run(
      'proj-private', 'Private Project', 'owner-id', 'org-1', 'private'
    );
    db.prepare('INSERT INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, ?)').run(
      'mem-1', 'proj-private', 'user-guest', 'GUEST'
    );

    const access = projectAccessForUser(db, 'proj-private', 'user-guest');
    expect(access).not.toBeNull();
    expect(access?.can_view).toBe(true);
    expect(access?.can_edit).toBe(false);
    expect(access?.can_manage_members).toBe(false);
    expect(access?.can_delete).toBe(false);
    expect(access?.can_view_items).toBe(true);
    expect(access?.can_edit_items).toBe(false);
    expect(access?.can_view_notes).toBe(true);
    expect(access?.can_edit_notes).toBe(false);
    expect(access?.can_generate_content).toBe(false);
  });

  it('denies access to a project from a different organization', () => {
    db.prepare('INSERT INTO users (id, email, password_hash, organization_id, system_role) VALUES (?, ?, ?, ?, ?)').run(
      'user-org1', 'user1@example.com', 'hash', 'org-1', 'USER'
    );
    db.prepare('INSERT INTO projects (id, name, owner_id, organization_id, visibility) VALUES (?, ?, ?, ?, ?)').run(
      'proj-org2', 'Org 2 Project', 'other-owner', 'org-2', 'public'
    );

    const access = projectAccessForUser(db, 'proj-org2', { id: 'user-org1', organization_id: 'org-1' });
    expect(access).toBeNull();
  });

  it('allows SYSTEM_ADMIN to view and edit any project within their organization', () => {
    db.prepare('INSERT INTO users (id, email, password_hash, organization_id, system_role) VALUES (?, ?, ?, ?, ?)').run(
      'user-admin', 'admin@example.com', 'hash', 'org-1', 'SYSTEM_ADMIN'
    );
    db.prepare('INSERT INTO projects (id, name, owner_id, organization_id, visibility) VALUES (?, ?, ?, ?, ?)').run(
      'proj-secret', 'Secret Project', 'other-user', 'org-1', 'private'
    );

    const access = projectAccessForUser(db, 'proj-secret', 'user-admin');
    expect(access).not.toBeNull();
    expect(access?.can_view).toBe(true);
    expect(access?.can_edit).toBe(true);
    expect(access?.can_delete).toBe(true);
    expect(access?.can_edit_items).toBe(true);
  });

  it('requireProjectPermission helper works consistently', () => {
    db.prepare('INSERT INTO users (id, email, password_hash, organization_id, system_role) VALUES (?, ?, ?, ?, ?)').run(
      'user-guest', 'guest@example.com', 'hash', 'org-1', 'USER'
    );
    db.prepare('INSERT INTO projects (id, name, owner_id, organization_id, visibility) VALUES (?, ?, ?, ?, ?)').run(
      'proj-2', 'Test 2', 'owner-id', 'org-1', 'private'
    );
    db.prepare('INSERT INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, ?)').run(
      'mem-2', 'proj-2', 'user-guest', 'GUEST'
    );

    expect(requireProjectPermission(db, 'proj-2', 'user-guest', 'view_project')).toBe(true);
    expect(requireProjectPermission(db, 'proj-2', 'user-guest', 'edit_project')).toBe(false);
    expect(requireProjectPermission(db, 'proj-2', 'user-guest', 'view_items')).toBe(true);
    expect(requireProjectPermission(db, 'proj-2', 'user-guest', 'edit_items')).toBe(false);
  });

  it('correctly checks manage_teams system permission', () => {
    db.prepare('INSERT INTO users (id, email, password_hash, organization_id, system_role) VALUES (?, ?, ?, ?, ?)').run(
      'admin-teams', 'admin@example.com', 'hash', 'org-1', 'SYSTEM_ADMIN'
    );
    db.prepare('INSERT INTO users (id, email, password_hash, organization_id, system_role) VALUES (?, ?, ?, ?, ?)').run(
      'mgr-teams', 'manager@example.com', 'hash', 'org-1', 'MANAGER'
    );
    db.prepare('INSERT INTO users (id, email, password_hash, organization_id, system_role) VALUES (?, ?, ?, ?, ?)').run(
      'user-teams', 'user@example.com', 'hash', 'org-1', 'USER'
    );

    expect(hasSystemPermission(db, 'admin-teams', 'manage_teams')).toBe(true);
    expect(hasSystemPermission(db, 'mgr-teams', 'manage_teams')).toBe(true);
    expect(hasSystemPermission(db, 'user-teams', 'manage_teams')).toBe(false);
  });
});
