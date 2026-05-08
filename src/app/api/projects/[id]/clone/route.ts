import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { requireSession } from '@/lib/auth';
import type { CloneOptions, Project, CustomField, ProjectContact, ProjectNote, Todo } from '@/types';

type ProjectSheet = { id: string; name: string; columns_def: string; rows_data: string };

interface Params { params: Promise<{ id: string }> }

export async function POST(request: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  try {
    const user = await requireSession();
    const db = getDb();
    const body = await request.json() as CloneOptions;

    if (!body.new_name?.trim()) {
      return NextResponse.json({ error: 'new_name は必須です' }, { status: 400 });
    }
    const includeValues = Boolean(body.include_values);
    const includeTodos = body.include_todos !== false;
    const includeSheets = body.include_sheets !== false;
    const includeContacts = body.include_contacts !== false;
    const includeNotes = body.include_notes === true;

    const source = db.prepare(`
      SELECT p.* FROM projects p
      LEFT JOIN project_members m ON p.id = m.project_id
      WHERE p.id = ? AND p.organization_id = ? AND (p.owner_id = ? OR m.user_id = ?)
    `).get(params.id, user.organization_id, user.id, user.id) as Project | undefined;

    if (!source) return NextResponse.json({ error: 'Source project not found' }, { status: 404 });

    const sourceFields = db.prepare('SELECT * FROM custom_fields WHERE project_id = ? ORDER BY sort_order ASC').all(params.id) as CustomField[];
    const sourceContacts = includeContacts
      ? db.prepare('SELECT * FROM project_contacts WHERE project_id = ? ORDER BY datetime(created_at) ASC, rowid ASC').all(params.id) as ProjectContact[]
      : [];
    const sourceSheets = includeSheets
      ? db.prepare('SELECT * FROM project_sheets WHERE project_id = ? ORDER BY datetime(created_at) ASC, rowid ASC').all(params.id) as ProjectSheet[]
      : [];
    const sourceNotes = includeNotes
      ? db.prepare('SELECT * FROM project_notes WHERE project_id = ? ORDER BY datetime(created_at) ASC, rowid ASC').all(params.id) as ProjectNote[]
      : [];
    const sourceTodos = includeTodos
      ? db.prepare('SELECT * FROM todos WHERE project_id = ? ORDER BY parent_id IS NOT NULL ASC, sort_order ASC, datetime(created_at) ASC').all(params.id) as Todo[]
      : [];

    const newId = uuidv4();

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO projects (id, name, type, phase_key, status, organization_id, owner_id, primary_assignee_id, cloned_from)
        VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?)
      `).run(
        newId,
        body.new_name.trim(),
        source.type,
        source.phase_key || '',
        source.organization_id || user.organization_id,
        user.id,
        user.id,
        params.id,
      );

      // 全フィールド（組み込み + カスタム）をクローン
      for (const field of sourceFields) {
        db.prepare(`
          INSERT INTO custom_fields
            (id, project_id, template_id, key, label, type, value, options, layout,
             inherited, inherited_from, crawled_content, sort_order, is_builtin, section)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          uuidv4(),
          newId,
          field.template_id ?? null,
          field.key,
          field.label,
          field.type,
          includeValues ? field.value : '',
          field.options,
          field.layout === 'full' ? 'full' : 'half',
          includeValues && field.value ? 1 : 0,
          includeValues && field.value ? params.id : null,
          includeValues ? (field.crawled_content ?? null) : null,
          field.sort_order,
          field.is_builtin ?? 0,
          field.section ?? '',
        );
      }

      for (const contact of sourceContacts) {
        db.prepare(`
          INSERT INTO project_contacts (id, project_id, name, email, phone, company_name)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          uuidv4(),
          newId,
          contact.name ?? '',
          contact.email ?? '',
          contact.phone ?? '',
          contact.company_name ?? '',
        );
      }

      for (const sheet of sourceSheets) {
        db.prepare(`
          INSERT INTO project_sheets (id, project_id, name, columns_def, rows_data, created_by)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          uuidv4(),
          newId,
          sheet.name || '新しいシート',
          sheet.columns_def || '[]',
          includeValues ? (sheet.rows_data || '[]') : '[]',
          user.id,
        );
      }

      for (const note of sourceNotes) {
        db.prepare(`
          INSERT INTO project_notes (id, project_id, title, body, pinned, created_by)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          uuidv4(),
          newId,
          note.title ?? '',
          includeValues ? (note.body ?? '') : '',
          note.pinned ?? 0,
          user.id,
        );
      }

      const todoIdMap = new Map<string, string>();
      for (const todo of sourceTodos) {
        todoIdMap.set(todo.id, uuidv4());
      }
      for (const todo of sourceTodos) {
        const clonedTodoId = todoIdMap.get(todo.id);
        if (!clonedTodoId) continue;
        const clonedParentId = todo.parent_id ? todoIdMap.get(todo.parent_id) ?? null : null;
        db.prepare(`
          INSERT INTO todos (
            id, project_id, parent_id, title, description, status, priority, assignee_id,
            phase_key, start_date, due_date, sort_order, created_by, completed_at, completed_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          clonedTodoId,
          newId,
          clonedParentId,
          todo.title ?? '',
          todo.description ?? '',
          includeValues ? (todo.status ?? 'todo') : 'todo',
          todo.priority ?? 'medium',
          includeValues ? (todo.assignee_id ?? null) : null,
          todo.phase_key ?? '',
          includeValues ? (todo.start_date ?? '') : '',
          includeValues ? (todo.due_date ?? '') : '',
          todo.sort_order ?? 0,
          user.id,
          includeValues && todo.status === 'done' ? (todo.completed_at ?? null) : null,
          includeValues && todo.status === 'done' ? (todo.completed_by ?? null) : null,
        );
      }
    });
    tx();

    const cloned = db.prepare('SELECT * FROM projects WHERE id = ?').get(newId);
    return NextResponse.json(cloned, { status: 201 });
  } catch (err) {
    console.error('POST /api/projects/[id]/clone failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
