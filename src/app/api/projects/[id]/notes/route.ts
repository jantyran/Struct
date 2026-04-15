import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectNote } from '@/types';

interface Params { params: { id: string } }

async function checkProjectAccess(projectId: string, userId: string) {
  const db = getDb();
  return db.prepare(`
    SELECT DISTINCT p.* FROM projects p
    LEFT JOIN project_members m ON p.id = m.project_id
    WHERE p.id = ? AND (p.owner_id = ? OR m.user_id = ?)
  `).get(projectId, userId, userId);
}

/** ノート一覧取得 */
export async function GET(_req: Request, { params }: Params) {
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
export async function POST(req: Request, { params }: Params) {
  let user;
  try {
    user = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await checkProjectAccess(params.id, user.id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: { title?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const title = (body.title ?? '').trim();
  const noteBody = (body.body ?? '').trim();

  try {
    const db = getDb();
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
