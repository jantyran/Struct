import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthSession } from '@/lib/auth';
import { requireProjectPermission } from '@/lib/permissions';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectNote } from '@/types';

interface Params { params: Promise<{ id: string }> }

/** ノート一覧取得 */
export async function GET(_req: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  const { user, errorResponse } = await getAuthSession();
  if (errorResponse) return errorResponse;

  const db = getDb();
  if (!requireProjectPermission(db, params.id, user, 'view_notes')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const notes = db.prepare(`
      SELECT * FROM project_notes
      WHERE project_id = ?
      ORDER BY pinned DESC, updated_at DESC
    `).all(params.id) as ProjectNote[];
    return NextResponse.json(notes);
  } catch (err) {
    console.error('GET /api/projects/[id]/notes failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** ノート作成 */
export async function POST(req: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  const { user, errorResponse } = await getAuthSession();
  if (errorResponse) return errorResponse;

  const db = getDb();
  if (!requireProjectPermission(db, params.id, user, 'edit_notes')) {
    return NextResponse.json({ error: 'ノート編集権限がありません' }, { status: 403 });
  }

  let body: { title?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const title = (body.title ?? '').trim();
  const noteBody = (body.body ?? '').trim();

  try {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO project_notes (id, project_id, title, body, pinned, created_by)
      VALUES (?, ?, ?, ?, 0, ?)
    `).run(id, params.id, title, noteBody, user.id);

    const note = db.prepare('SELECT * FROM project_notes WHERE id = ?').get(id) as ProjectNote;
    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    console.error('POST /api/projects/[id]/notes failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
