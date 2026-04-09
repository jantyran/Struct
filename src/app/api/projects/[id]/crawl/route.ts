import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { crawlUrl } from '@/lib/crawler';

interface Params { params: { id: string } }

export async function POST(request: Request, { params }: Params) {
  const db = getDb();
  const body = await request.json() as { field_id: string };

  if (!body.field_id) {
    return NextResponse.json({ error: 'field_id が必要です' }, { status: 400 });
  }

  const field = db.prepare(
    'SELECT * FROM custom_fields WHERE id = ? AND project_id = ?'
  ).get(body.field_id, params.id) as { id: string; type: string; value: string } | undefined;

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
}
