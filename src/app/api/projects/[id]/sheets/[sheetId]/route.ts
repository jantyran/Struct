import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { requireProjectPermission } from '@/lib/permissions';

interface SheetRow { id: string; project_id: string; name: string; columns_def: string; rows_data: string; created_by: string; created_at: string; updated_at: string; }

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; sheetId: string }> }) {
  const { id, sheetId } = await params;
  const user = await requireSession();
  const db = getDb();
  if (!requireProjectPermission(db, id, user.id, 'edit_items')) {
    return NextResponse.json({ error: 'シート編集権限がありません' }, { status: 403 });
  }

  const body = await req.json() as { name?: string; columns_def?: unknown[]; rows_data?: unknown[] };
  const existing = db.prepare('SELECT * FROM project_sheets WHERE id = ? AND project_id = ?').get(sheetId, id) as SheetRow | undefined;
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  db.prepare(`
    UPDATE project_sheets SET
      name = ?,
      columns_def = ?,
      rows_data = ?,
      updated_at = datetime('now')
    WHERE id = ? AND project_id = ?
  `).run(
    body.name ?? existing.name,
    JSON.stringify(body.columns_def ?? JSON.parse(existing.columns_def)),
    JSON.stringify(body.rows_data ?? JSON.parse(existing.rows_data)),
    sheetId,
    id,
  );
  const row = db.prepare('SELECT * FROM project_sheets WHERE id = ? AND project_id = ?').get(sheetId, id) as SheetRow;
  return NextResponse.json({ ...row, columns_def: JSON.parse(row.columns_def), rows_data: JSON.parse(row.rows_data) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; sheetId: string }> }) {
  const { id, sheetId } = await params;
  const user = await requireSession();
  const db = getDb();
  if (!requireProjectPermission(db, id, user.id, 'edit_items')) {
    return NextResponse.json({ error: 'シート編集権限がありません' }, { status: 403 });
  }

  const result = db.prepare('DELETE FROM project_sheets WHERE id = ? AND project_id = ?').run(sheetId, id);
  if (result.changes === 0) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
