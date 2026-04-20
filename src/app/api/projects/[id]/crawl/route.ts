import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { crawlUrl } from '@/lib/crawler';
import { requireSession } from '@/lib/auth';

interface Params { params: { id: string } }

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireSession();
    const db = getDb();
    const body = await request.json() as { field_id: string };

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
    if (!field.value?.trim()) return NextResponse.json({ error: 'URLが入力されていません' }, { status: 400 });

    try {
      const content = await crawlUrl(field.value.trim());
      db.prepare('UPDATE custom_fields SET crawled_content = ? WHERE id = ?').run(content, field.id);
      return NextResponse.json({ success: true, content_length: content.length, preview: content.substring(0, 200) });
    } catch (err) {
      return NextResponse.json({ error: `クローリング失敗: ${(err as Error).message}` }, { status: 500 });
    }
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
