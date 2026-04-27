import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';

interface SheetRow { id: string; project_id: string; name: string; columns_def: string; rows_data: string; created_by: string; created_at: string; updated_at: string; }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  const db = getDb();
  const rows = db.prepare('SELECT * FROM project_sheets WHERE project_id = ? ORDER BY created_at ASC').all(id) as SheetRow[];
  return NextResponse.json(rows.map(r => ({
    ...r,
    columns_def: JSON.parse(r.columns_def),
    rows_data: JSON.parse(r.rows_data),
  })));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  const db = getDb();
  const body = await req.json() as { name?: string };
  const sheetId = uuidv4();
  db.prepare(`
    INSERT INTO project_sheets (id, project_id, name, columns_def, rows_data, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sheetId, id, body.name || '新しいシート', '[]', '[]', user.id);
  const row = db.prepare('SELECT * FROM project_sheets WHERE id = ?').get(sheetId) as SheetRow;
  return NextResponse.json({ ...row, columns_def: JSON.parse(row.columns_def), rows_data: JSON.parse(row.rows_data) });
}
