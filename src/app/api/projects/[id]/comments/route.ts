import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthSession } from '@/lib/auth';
import { requireProjectPermission } from '@/lib/permissions';
import { v4 as uuidv4 } from 'uuid';
import type { Comment, CommentTargetType } from '@/types';

interface Params {
  params: Promise<{ id: string }>;
}

const VALID_TARGET_TYPES: CommentTargetType[] = ['todo', 'note', 'generated_asset', 'custom_field'];

/** コメント一覧取得 */
export async function GET(req: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  const { user, errorResponse } = await getAuthSession();
  if (errorResponse) return errorResponse;

  const db = getDb();
  if (!requireProjectPermission(db, params.id, user, 'view_project')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const targetType = searchParams.get('target_type');
  const targetId = searchParams.get('target_id');

  try {
    let query = `
      SELECT c.*, u.name AS user_name, u.avatar_url AS user_avatar_url, u.email AS user_email
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.project_id = ?
    `;
    const sqlParams: unknown[] = [params.id];

    if (targetType) {
      query += ' AND c.target_type = ?';
      sqlParams.push(targetType);
    }
    if (targetId) {
      query += ' AND c.target_id = ?';
      sqlParams.push(targetId);
    }

    query += ' ORDER BY c.created_at ASC';

    const comments = db.prepare(query).all(...sqlParams) as Comment[];
    return NextResponse.json(comments);
  } catch (err) {
    console.error('GET /api/projects/[id]/comments failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** コメント新規作成 */
export async function POST(req: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  const { user, errorResponse } = await getAuthSession();
  if (errorResponse) return errorResponse;

  const db = getDb();
  if (!requireProjectPermission(db, params.id, user, 'view_project')) {
    return NextResponse.json({ error: 'コメント投稿権限がありません' }, { status: 403 });
  }

  let body: { target_type?: string; target_id?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const targetType = body.target_type as CommentTargetType;
  const targetId = (body.target_id ?? '').trim();
  const content = (body.content ?? '').trim();

  if (!VALID_TARGET_TYPES.includes(targetType)) {
    return NextResponse.json({ error: '無効な対象種別です' }, { status: 400 });
  }
  if (!targetId) {
    return NextResponse.json({ error: '対象IDが指定されていません' }, { status: 400 });
  }
  if (!content) {
    return NextResponse.json({ error: 'コメント本文を入力してください' }, { status: 400 });
  }

  try {
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO comments (id, project_id, target_type, target_id, user_id, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, params.id, targetType, targetId, user.id, content, now, now);

    const created = db.prepare(`
      SELECT c.*, u.name AS user_name, u.avatar_url AS user_avatar_url, u.email AS user_email
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(id) as Comment;

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('POST /api/projects/[id]/comments failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
