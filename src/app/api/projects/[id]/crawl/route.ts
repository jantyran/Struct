import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { crawlUrl } from '@/lib/crawler';
import { requireSession } from '@/lib/auth';

interface Params { params: { id: string } }

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireSession();
    const body = await request.json() as { field_id: string };

    if (!body.field_id) {
      return NextResponse.json({ error: 'field_id が必要です' }, { status: 400 });
    }

    const field = await prisma.customField.findFirst({
      where: {
        id: body.field_id,
        project: {
          id: params.id,
          OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
        }
      }
    });

    if (!field) return NextResponse.json({ error: 'Field not found' }, { status: 404 });
    if (field.type !== 'url') return NextResponse.json({ error: 'URL型フィールドのみクローリング可能です' }, { status: 400 });
    if (!field.value?.trim()) return NextResponse.json({ error: 'URLが入力されていません' }, { status: 400 });

    try {
      const content = await crawlUrl(field.value.trim());
      await prisma.customField.update({
        where: { id: field.id },
        data: { crawledContent: content }
      });
      return NextResponse.json({ success: true, content_length: content.length, preview: content.substring(0, 200) });
    } catch (err) {
      return NextResponse.json({ error: `クローリング失敗: ${(err as Error).message}` }, { status: 500 });
    }
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
