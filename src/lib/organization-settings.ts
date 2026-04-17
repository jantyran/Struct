import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export const DEFAULT_ORGANIZATION_SLUG = 'default';
export const DEFAULT_ORGANIZATION_NAME = 'Default Organization';
export const buildOrganizationSettingsScopeKey = (organizationId: string) => `org-settings:${organizationId}`;

export function ensureDefaultOrganization(db: Database.Database) {
  let organization = db.prepare(`
    SELECT *
    FROM organizations
    ORDER BY datetime(COALESCE(created_at, '1970-01-01')) ASC, rowid ASC
    LIMIT 1
  `).get() as any;
  if (!organization) {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO organizations (
        id, name, slug, status, address_street, address_city, address_state,
        address_postal_code, address_country, default_language, default_locale,
        default_time_zone, currency_locale, updated_at
      )
      VALUES (?, ?, ?, 'active', '', '', '', '', 'Japan', 'ja', 'ja-JP', 'Asia/Tokyo', 'ja-JP', datetime('now'))
    `).run(id, DEFAULT_ORGANIZATION_NAME, DEFAULT_ORGANIZATION_SLUG);
    organization = db.prepare('SELECT * FROM organizations WHERE id = ?').get(id) as any;
  }
  return organization;
}

export function getOrganizationRow(db: Database.Database, organizationId?: string) {
  const resolvedOrganizationId = organizationId || getDefaultOrganizationId(db);
  let organization = db.prepare('SELECT * FROM organizations WHERE id = ?').get(resolvedOrganizationId) as any;
  if (!organization) {
    organization = ensureDefaultOrganization(db);
  }
  return organization;
}

export function getDefaultOrganizationId(db: Database.Database) {
  return ensureDefaultOrganization(db).id as string;
}

export function getUserOrganizationId(db: Database.Database, userId: string) {
  const row = db.prepare('SELECT organization_id FROM users WHERE id = ?').get(userId) as { organization_id?: string | null } | undefined;
  if (row?.organization_id) return row.organization_id;
  return getDefaultOrganizationId(db);
}

export function getOrganizationSettingsRow(db: Database.Database, organizationId?: string) {
  const resolvedOrganizationId = organizationId || getDefaultOrganizationId(db);
  let row = db.prepare('SELECT * FROM organization_settings WHERE organization_id = ?').get(resolvedOrganizationId) as any;
  if (!row) {
    db.prepare(`
      INSERT INTO organization_settings (id, organization_id, scope_key)
      VALUES (?, ?, ?)
    `).run(uuidv4(), resolvedOrganizationId, buildOrganizationSettingsScopeKey(resolvedOrganizationId));
    row = db.prepare('SELECT * FROM organization_settings WHERE organization_id = ?').get(resolvedOrganizationId) as any;
  }
  return row;
}
