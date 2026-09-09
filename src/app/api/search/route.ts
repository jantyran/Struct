import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { requireProjectPermission } from '@/lib/permissions';

type SearchResultType = 'project' | 'todo' | 'note' | 'asset' | 'field' | 'master_data';

interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  excerpt: string;
  project_id: string;
  project_name: string;
  href: string;
  updated_at: string;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function normalizeQuery(value: string | null) {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function excerpt(...values: Array<string | null | undefined>) {
  const text = values.find((value) => value?.trim())?.trim() ?? '';
  if (text.length <= 120) return text;
  return `${text.slice(0, 117)}...`;
}

function uniqueResults(results: SearchResult[], limit: number) {
  const seen = new Set<string>();
  const next: SearchResult[] = [];
  for (const result of results) {
    const key = `${result.type}:${result.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(result);
    if (next.length >= limit) break;
  }
  return next;
}

export async function GET(request: Request) {
  try {
    const user = await requireSession();
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const q = normalizeQuery(searchParams.get('q'));
    const limit = Math.min(40, Math.max(5, Number(searchParams.get('limit') ?? 20) || 20));
    if (q.length < 2) return NextResponse.json({ query: q, results: [] });

    const like = `%${escapeLike(q)}%`;
    const args = [user.organization_id, like, like];
    const results: SearchResult[] = [];

    const projects = db.prepare(`
      SELECT id, name, description, updated_at
      FROM projects
      WHERE organization_id = ?
        AND (name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')
      ORDER BY datetime(updated_at) DESC
      LIMIT 30
    `).all(...args) as Array<{ id: string; name: string; description: string | null; updated_at: string }>;
    for (const project of projects) {
      if (!requireProjectPermission(db, project.id, user.id, 'view_project')) continue;
      results.push({
        id: project.id,
        type: 'project',
        title: project.name,
        excerpt: excerpt(project.description),
        project_id: project.id,
        project_name: project.name,
        href: `/projects/${project.id}`,
        updated_at: project.updated_at,
      });
    }

    const todos = db.prepare(`
      SELECT t.id, t.title, t.description, t.updated_at, p.id AS project_id, p.name AS project_name
      FROM todos t
      JOIN projects p ON p.id = t.project_id
      WHERE p.organization_id = ?
        AND (t.title LIKE ? ESCAPE '\\' OR t.description LIKE ? ESCAPE '\\')
      ORDER BY datetime(t.updated_at) DESC
      LIMIT 40
    `).all(...args) as Array<{ id: string; title: string; description: string | null; updated_at: string; project_id: string; project_name: string }>;
    for (const todo of todos) {
      if (!requireProjectPermission(db, todo.project_id, user.id, 'view_items')) continue;
      results.push({
        id: todo.id,
        type: 'todo',
        title: todo.title,
        excerpt: excerpt(todo.description),
        project_id: todo.project_id,
        project_name: todo.project_name,
        href: `/projects/${todo.project_id}?tab=todos&todo=${todo.id}`,
        updated_at: todo.updated_at,
      });
    }

    const notes = db.prepare(`
      SELECT n.id, n.title, n.body, n.updated_at, p.id AS project_id, p.name AS project_name
      FROM project_notes n
      JOIN projects p ON p.id = n.project_id
      WHERE p.organization_id = ?
        AND (n.title LIKE ? ESCAPE '\\' OR n.body LIKE ? ESCAPE '\\')
      ORDER BY datetime(n.updated_at) DESC
      LIMIT 40
    `).all(...args) as Array<{ id: string; title: string; body: string; updated_at: string; project_id: string; project_name: string }>;
    for (const note of notes) {
      if (!requireProjectPermission(db, note.project_id, user.id, 'view_notes')) continue;
      results.push({
        id: note.id,
        type: 'note',
        title: note.title || '無題のノート',
        excerpt: excerpt(note.body),
        project_id: note.project_id,
        project_name: note.project_name,
        href: `/projects/${note.project_id}?tab=notes`,
        updated_at: note.updated_at,
      });
    }

    const assets = db.prepare(`
      SELECT a.id, a.title, a.content, a.created_at, p.id AS project_id, p.name AS project_name
      FROM generated_assets a
      JOIN projects p ON p.id = a.project_id
      WHERE p.organization_id = ?
        AND (a.title LIKE ? ESCAPE '\\' OR a.content LIKE ? ESCAPE '\\')
      ORDER BY datetime(a.created_at) DESC
      LIMIT 40
    `).all(...args) as Array<{ id: string; title: string; content: string; created_at: string; project_id: string; project_name: string }>;
    for (const asset of assets) {
      if (!requireProjectPermission(db, asset.project_id, user.id, 'view_content')) continue;
      results.push({
        id: asset.id,
        type: 'asset',
        title: asset.title,
        excerpt: excerpt(asset.content),
        project_id: asset.project_id,
        project_name: asset.project_name,
        href: `/projects/${asset.project_id}?tab=assets`,
        updated_at: asset.created_at,
      });
    }

    const fields = db.prepare(`
      SELECT f.id, f.label, f.value, p.id AS project_id, p.name AS project_name, p.updated_at
      FROM custom_fields f
      JOIN projects p ON p.id = f.project_id
      WHERE p.organization_id = ?
        AND (f.label LIKE ? ESCAPE '\\' OR f.value LIKE ? ESCAPE '\\')
      ORDER BY datetime(p.updated_at) DESC
      LIMIT 40
    `).all(...args) as Array<{ id: string; label: string; value: string; project_id: string; project_name: string; updated_at: string }>;
    for (const field of fields) {
      if (!requireProjectPermission(db, field.project_id, user.id, 'view_items')) continue;
      results.push({
        id: field.id,
        type: 'field',
        title: field.label,
        excerpt: excerpt(field.value),
        project_id: field.project_id,
        project_name: field.project_name,
        href: `/projects/${field.project_id}?tab=fields`,
        updated_at: field.updated_at,
      });
    }

    // マスターデータ（共通定義・レコード）の検索
    const orgSettings = db.prepare('SELECT objects, updated_at FROM organization_settings WHERE organization_id = ?').get(user.organization_id) as { objects?: string; updated_at?: string } | undefined;
    if (orgSettings?.objects) {
      try {
        const objects = JSON.parse(orgSettings.objects) as Array<{
          id: string;
          name: string;
          description?: string;
          records?: Array<{ id: string; name: string; values?: Record<string, unknown> }>;
        }>;
        const qLower = q.toLowerCase();
        for (const obj of objects) {
          const objNameMatch = (obj.name || '').toLowerCase().includes(qLower);
          const objDescMatch = (obj.description || '').toLowerCase().includes(qLower);
          if (objNameMatch || objDescMatch) {
            results.push({
              id: obj.id,
              type: 'master_data',
              title: `マスターデータ: ${obj.name}`,
              excerpt: excerpt(obj.description),
              project_id: '',
              project_name: 'マスターデータ',
              href: `/master-data/${obj.id}`,
              updated_at: orgSettings.updated_at || new Date().toISOString(),
            });
          }

          for (const rec of obj.records || []) {
            const recNameMatch = (rec.name || '').toLowerCase().includes(qLower);
            let matchedValue = '';
            if (rec.values) {
              for (const val of Object.values(rec.values)) {
                if (typeof val === 'string' && val.toLowerCase().includes(qLower)) {
                  matchedValue = val;
                  break;
                }
              }
            }
            if (recNameMatch || matchedValue) {
              results.push({
                id: `${obj.id}:${rec.id}`,
                type: 'master_data',
                title: `${obj.name} › ${rec.name || 'レコード'}`,
                excerpt: excerpt(matchedValue || rec.name),
                project_id: '',
                project_name: 'マスターデータ',
                href: `/master-data/${obj.id}`,
                updated_at: orgSettings.updated_at || new Date().toISOString(),
              });
            }
          }
        }
      } catch (err) {
        console.error('Failed to parse objects for search', err);
      }
    }

    results.sort((a, b) => Date.parse(b.updated_at || '') - Date.parse(a.updated_at || ''));
    return NextResponse.json({ query: q, results: uniqueResults(results, limit) });
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
