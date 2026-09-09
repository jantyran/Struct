import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthSession } from '@/lib/auth';
import { requireProjectPermission } from '@/lib/permissions';

interface Params {
  params: Promise<{ id: string; commentId: string }>;
}

/** コメント削除 */
export async function DELETE(_req: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  const { user, errorResponse } = await getAuthSession();
  if (errorResponse) return errorResponse;

  const db = getDb();
  if (!requireProjectPermission(db, params.id, user, 'view_project')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const comment = db.prepare(`
      SELECT * FROM comments WHERE id = ? AND project_id = ?
    `).get(params.commentId, params.id) as { id: string; user_id: string } | undefined;

    if (!comment) {
      return NextResponse.json({ error: 'コメントが見つかりません' }, { status: 404 });
    }

    const project = db.prepare('SELECT owner_id FROM projects WHERE id = ?').get(params.id) as { owner_id: string } | undefined;
    const isAuthor = comment.user_id === user.id;
    const isOwner = project?.owner_id === user.id;
    const isAdmin = user.system_permissions.edit_all_projects;

    if (!isAuthor && !isOwner && !isAdmin) {
      return NextResponse.json({ error: 'コメントを削除する権限がありません' }, { status: 403 });
    }

    db.prepare('DELETE FROM comments WHERE id = ?').run(params.commentId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/projects/[id]/comments/[commentId] failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
