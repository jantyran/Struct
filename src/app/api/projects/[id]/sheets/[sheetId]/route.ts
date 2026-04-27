import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';

interface SheetRow { id: string; project_id: string; name: string; columns_def: string; rows_data: string; created_by: string; created_at: string; updated_at: string; }

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; sheetId: string }> }) {
  const { sheetId } = await params;
  await requireSession();
  const db = getDb();
  const body = await req.json() as { name?: string; columns_def?: unknown[]; rows_data?: unknown[] };
  const existing = db.prepare('SELECT * FROM project_sheets WHERE id = ?').get(sheetId) as SheetRow | undefined;
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  db.prepare(`
    UPDATE project_sheets SET
      name = ?,
      columns_def = ?,
      rows_data = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    body.name ?? existing.name,
    JSON.stringify(body.columns_def ?? JSON.parse(existing.columns_def)),
    JSON.stringify(body.rows_data ?? JSON.parse(existing.rows_data)),
    sheetId,
  );
  const row = db.prepare('SELECT * FROM project_sheets WHERE id = ?').get(sheetId) as SheetRow;
  return NextResponse.json({ ...row, columns_def: JSON.parse(row.columns_def), rows_data: JSON.parse(row.rows_data) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; sheetId: string }> }) {
  const { sheetId } = await params;
  await requireSession();
  const db = getDb();
  db.prepare('DELETE FROM project_sheets WHERE id = ?').run(sheetId);
  return NextResponse.json({ ok: true });
}
