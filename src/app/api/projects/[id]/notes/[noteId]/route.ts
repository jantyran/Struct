import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import type { ProjectNote } from '@/types';

interface Params { params: { id: string; noteId: string } }

async function checkProjectAccess(projectId: string, userId: string) {
  const db = getDb();
  return db.prepare(`
    SELECT DISTINCT p.* FROM projects p
    LEFT JOIN project_members m ON p.id = m.project_id
    WHERE p.id = ? AND (p.owner_id = ? OR m.user_id = ?)
  `).get(projectId, userId, userId);
}

/** ノート更新（title / body / pinned） */
export async function PATCH(req: Request, { params }: Params) {
  let user;
  try {
    user = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await checkProjectAccess(params.id, user.id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: { title?: string; body?: string; pinned?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const db = getDb();
    const note = db.prepare('SELECT * FROM project_notes WHERE id = ? AND project_id = ?').get(
      params.noteId, params.id
    ) as ProjectNote | undefined;
    if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updatedTitle = body.title !== undefined ? body.title.trim() : note.title;
    const updatedBody = body.body !== undefined ? body.body : note.body;
    const updatedPinned = body.pinned !== undefined ? (body.pinned ? 1 : 0) : note.pinned;

    db.prepare(`
      UPDATE project_notes
      SET title = ?, body = ?, pinned = ?, updated_at = datetime('now')
      WHERE id = ? AND project_id = ?
    `).run(updatedTitle, updatedBody, updatedPinned, params.noteId, params.id);

    const updated = db.prepare('SELECT * FROM project_notes WHERE id = ?').get(params.noteId) as ProjectNote;
    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/projects/[id]/notes/[noteId] failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** ノート削除 */
export async function DELETE(_req: Request, { params }: Params) {
  let user;
  try {
    user = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await checkProjectAccess(params.id, user.id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM project_notes WHERE id = ? AND project_id = ?').run(
      params.noteId, params.id
    );
    if (result.changes === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/projects/[id]/notes/[noteId] failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
