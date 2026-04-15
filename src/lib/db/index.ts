import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { BUILTIN_FIELD_TEMPLATES } from '@/lib/project-types';

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

    -- カスタムフィールド（組み込み + ユーザー定義を統合管理）
    CREATE TABLE IF NOT EXISTS custom_fields (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      template_id TEXT,
      key TEXT NOT NULL,
      label TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      value TEXT DEFAULT '',
      options TEXT DEFAULT '{}',
      layout TEXT DEFAULT 'half',
      inherited INTEGER DEFAULT 0,
      inherited_from TEXT,
      crawled_content TEXT,
      sort_order INTEGER DEFAULT 0,
      is_builtin INTEGER DEFAULT 0,
      section TEXT DEFAULT '',
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

    -- プロジェクトノート
    CREATE TABLE IF NOT EXISTS project_notes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      pinned INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
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
  ensureColumn(db, 'custom_fields', 'is_builtin', `INTEGER DEFAULT 0`);
  ensureColumn(db, 'custom_fields', 'section', `TEXT DEFAULT ''`);

  // 既存プロジェクトのコアカラム値を custom_fields に移行
  migrateProjectCoreFields(db);
}

/**
 * projects テーブルの旧コアカラム（target, start_date, end_date, budget, channels, description）を
 * custom_fields 行として移行する。既に移行済みのプロジェクトはスキップ。
 */
function migrateProjectCoreFields(db: Database.Database) {
  const projects = db.prepare(`
    SELECT id, target, start_date, end_date, budget, channels, description
    FROM projects
  `).all() as Array<{
    id: string;
    target: string;
    start_date: string;
    end_date: string;
    budget: string;
    channels: string;
    description: string;
  }>;

  // key → old column value のマッピング（インデックス依存を排除）
  function legacyValueFor(key: string, project: typeof projects[number]): string {
    switch (key) {
      case 'target':      return project.target || '';
      case 'start_date':  return project.start_date || '';
      case 'end_date':    return project.end_date || '';
      case 'budget':      return project.budget || '';
      case 'channels':    return normalizeChannelsValue(project.channels);
      case 'description': return project.description || '';
      default:            return '';
    }
  }

  for (const project of projects) {
    // 既に組み込みフィールドが存在するプロジェクトはスキップ
    const existingBuiltins = db.prepare(
      'SELECT COUNT(*) as cnt FROM custom_fields WHERE project_id = ? AND is_builtin = 1'
    ).get(project.id) as { cnt: number };

    if (existingBuiltins.cnt > 0) continue;

    const tx = db.transaction(() => {
      const existingCount = (db.prepare(
        'SELECT COUNT(*) as cnt FROM custom_fields WHERE project_id = ?'
      ).get(project.id) as { cnt: number }).cnt;

      BUILTIN_FIELD_TEMPLATES.forEach((def, i) => {
        const value = legacyValueFor(def.key, project);
        db.prepare(`
          INSERT INTO custom_fields
            (id, project_id, template_id, key, label, type, value, options, layout,
             inherited, inherited_from, crawled_content, sort_order, is_builtin, section)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, 1, ?)
        `).run(
          uuidv4(),
          project.id,
          def.id,
          def.key,
          def.label,
          def.type,
          value,
          def.options,
          def.layout ?? 'half',
          existingCount + i,
          def.section ?? '基本情報',
        );
      });
    });
    tx();
  }
}

/** channels の JSON 配列文字列をカンマ区切りに変換 */
function normalizeChannelsValue(channels: string): string {
  try {
    const arr = JSON.parse(channels || '[]');
    if (Array.isArray(arr)) return arr.join(', ');
  } catch { /* ignore */ }
  return channels || '';
}
