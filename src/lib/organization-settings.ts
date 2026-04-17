import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export const DEFAULT_ORGANIZATION_SCOPE = 'default';

export function getOrganizationSettingsRow(db: Database.Database) {
  let row = db.prepare('SELECT * FROM organization_settings WHERE scope_key = ?').get(DEFAULT_ORGANIZATION_SCOPE) as any;
  if (!row) {
    db.prepare(`
      INSERT INTO organization_settings (id, scope_key)
      VALUES (?, ?)
    `).run(uuidv4(), DEFAULT_ORGANIZATION_SCOPE);
    row = db.prepare('SELECT * FROM organization_settings WHERE scope_key = ?').get(DEFAULT_ORGANIZATION_SCOPE) as any;
  }
  return row;
}
