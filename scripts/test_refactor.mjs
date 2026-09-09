import assert from 'node:assert';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'struct.db');
const db = new Database(dbPath);

// 1. Verify schema tables exist
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
assert(tables.includes('projects'), 'projects table must exist');
assert(tables.includes('users'), 'users table must exist');
assert(tables.includes('todos'), 'todos table must exist');
assert(tables.includes('system_role_definitions'), 'system_role_definitions table must exist');

// 2. Verify subquery execution for todo counts (which replaced N+1 todoSummary)
const testProject = db.prepare('SELECT id, name FROM projects LIMIT 1').get();
if (testProject) {
  const row = db.prepare(`
    SELECT
      p.id, p.name,
      (SELECT COUNT(*) FROM todos t WHERE t.project_id = p.id) AS todo_total,
      (SELECT COUNT(*) FROM todos t WHERE t.project_id = p.id AND t.status = 'done') AS todo_done,
      (SELECT COUNT(*) FROM todos t WHERE t.project_id = p.id AND t.status <> 'done' AND t.due_date <> '' AND date(t.due_date) < date('now')) AS todo_overdue
    FROM projects p
    WHERE p.id = ?
  `).get(testProject.id);

  assert(row !== undefined, 'Project row must exist');
  assert(typeof row.todo_total === 'number', 'todo_total must be number');
  assert(typeof row.todo_done === 'number', 'todo_done must be number');
  assert(typeof row.todo_overdue === 'number', 'todo_overdue must be number');
}

console.log('✓ Self-check tests passed successfully');
