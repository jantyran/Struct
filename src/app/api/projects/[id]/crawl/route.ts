import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { crawlUrl } from '@/lib/crawler';
import { requireSession } from '@/lib/auth';
import { requireProjectPermission } from '@/lib/permissions';

interface Params { params: Promise<{ id: string }> }

export async function POST(request: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  try {
    const user = await requireSession();
    const db = getDb();
    const body = await request.json() as { field_id: string };

    if (!requireProjectPermission(db, params.id, user.id, 'edit_items')) {
      return NextResponse.json({ error: '項目編集権限がありません' }, { status: 403 });
    }

    if (!body.field_id) {
      return NextResponse.json({ error: 'field_id が必要です' }, { status: 400 });
    }

    const field = db.prepare(`
      SELECT f.* FROM custom_fields f
      JOIN projects p ON f.project_id = p.id
      LEFT JOIN project_members m ON p.id = m.project_id
      WHERE f.id = ? AND p.id = ? AND p.organization_id = ? AND (p.owner_id = ? OR m.user_id = ?)
    `).get(body.field_id, params.id, user.organization_id, user.id, user.id) as any;

    if (!field) return NextResponse.json({ error: 'Field not found' }, { status: 404 });
    if (field.type !== 'url') return NextResponse.json({ error: 'URL型フィールドのみクローリング可能です' }, { status: 400 });
    const rawValue = field.value?.trim() ?? '';
    let targetUrl = rawValue;
    try {
      const parsed = JSON.parse(rawValue);
      if (parsed && typeof parsed === 'object' && 'url' in parsed) targetUrl = String(parsed.url ?? '');
    } catch { /* plain URL */ }

    if (!targetUrl) return NextResponse.json({ error: 'URLが入力されていません' }, { status: 400 });

    try {
      const content = await crawlUrl(targetUrl);
      db.prepare('UPDATE custom_fields SET crawled_content = ? WHERE id = ?').run(content, field.id);
      return NextResponse.json({ success: true, content_length: content.length, preview: content.substring(0, 200) });
    } catch (err) {
      return NextResponse.json({ error: `クローリング失敗: ${(err as Error).message}` }, { status: 500 });
    }
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
