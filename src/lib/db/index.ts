import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync } from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'struct.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function initSchema(db: Database.Database) {
  db.exec(`
    -- ユーザー
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- プロジェクト（所有者 owner_id で管理）
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'campaign',
      phase_key TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      owner_id TEXT NOT NULL,
      cloned_from TEXT,
      target TEXT DEFAULT '',
      start_date TEXT DEFAULT '',
      end_date TEXT DEFAULT '',
      budget TEXT DEFAULT '',
      channels TEXT DEFAULT '[]',
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- プロジェクトメンバー（招待済みユーザーの管理）
    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'MEMBER',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(project_id, user_id)
    );

    -- 招待（未登録メールアドレスへの招待）
    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      role TEXT DEFAULT 'MEMBER',
      status TEXT DEFAULT 'PENDING',
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Global Assets（ユーザーごとに1つ）
    CREATE TABLE IF NOT EXISTS global_assets (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      company_name TEXT DEFAULT '',
      company_description TEXT DEFAULT '',
      brand_voice TEXT DEFAULT '',
      brand_guidelines TEXT DEFAULT '',
      products TEXT DEFAULT '[]',
      objects TEXT DEFAULT '[]',
      project_types TEXT DEFAULT '[]',
      content_templates TEXT DEFAULT '[]',
      ai_settings TEXT DEFAULT '{}',
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- カスタムフィールド
    CREATE TABLE IF NOT EXISTS custom_fields (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      template_id TEXT,
      key TEXT NOT NULL,
      label TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      value TEXT DEFAULT '',
      options TEXT DEFAULT '[]',
      layout TEXT DEFAULT 'half',
      inherited INTEGER DEFAULT 0,
      inherited_from TEXT,
      crawled_content TEXT,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 生成済みアセット
    CREATE TABLE IF NOT EXISTS generated_assets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      warnings TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  ensureColumn(db, 'global_assets', 'objects', `TEXT DEFAULT '[]'`);
  ensureColumn(db, 'global_assets', 'project_types', `TEXT DEFAULT '[]'`);
  ensureColumn(db, 'global_assets', 'content_templates', `TEXT DEFAULT '[]'`);
  ensureColumn(db, 'global_assets', 'ai_settings', `TEXT DEFAULT '{}'`);
  ensureColumn(db, 'projects', 'phase_key', `TEXT DEFAULT ''`);
  ensureColumn(db, 'custom_fields', 'template_id', `TEXT`);
  ensureColumn(db, 'custom_fields', 'layout', `TEXT DEFAULT 'half'`);
}
