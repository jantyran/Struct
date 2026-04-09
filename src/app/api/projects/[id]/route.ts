import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import type { CustomField } from '@/types';

interface Params { params: { id: string } }

export async function GET(_req: Request, { params }: Params) {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const fields = db.prepare('SELECT * FROM custom_fields WHERE project_id = ? ORDER BY sort_order').all(params.id) as CustomField[];
  return NextResponse.json({ ...project, custom_fields: fields });
}

export async function PUT(request: Request, { params }: Params) {
  const db = getDb();
  const body = await request.json() as {
    name?: string;
    type?: string;
    status?: string;
    target?: string;
    start_date?: string;
    end_date?: string;
    budget?: string;
    channels?: string[];
    description?: string;
    custom_fields?: Array<{
      id?: string;
      key: string;
      label: string;
      type: string;
      value?: string;
      options?: string[];
      inherited?: number;
      sort_order?: number;
    }>;
  };

  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  db.prepare(`
    UPDATE projects SET
      name = COALESCE(?, name),
      type = COALESCE(?, type),
      status = COALESCE(?, status),
      target = COALESCE(?, target),
      start_date = COALESCE(?, start_date),
      end_date = COALESCE(?, end_date),
      budget = COALESCE(?, budget),
      channels = COALESCE(?, channels),
      description = COALESCE(?, description),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    body.name ?? null,
    body.type ?? null,
    body.status ?? null,
    body.target ?? null,
    body.start_date ?? null,
    body.end_date ?? null,
    body.budget ?? null,
    body.channels !== undefined ? JSON.stringify(body.channels) : null,
    body.description ?? null,
    params.id,
  );

  // カスタムフィールドの同期
  if (body.custom_fields !== undefined) {
    const incomingIds = body.custom_fields.filter(f => f.id).map(f => f.id);

    // 削除: incoming に含まれていない既存フィールド
    const existing_fields = db.prepare('SELECT id FROM custom_fields WHERE project_id = ?').all(params.id) as { id: string }[];
    for (const ef of existing_fields) {
      if (!incomingIds.includes(ef.id)) {
        db.prepare('DELETE FROM custom_fields WHERE id = ?').run(ef.id);
      }
    }

    // upsert
    body.custom_fields.forEach((f, idx) => {
      if (f.id) {
        db.prepare(`
          UPDATE custom_fields SET
            key = ?, label = ?, type = ?, value = ?, options = ?, sort_order = ?
          WHERE id = ? AND project_id = ?
        `).run(f.key, f.label, f.type, f.value ?? '', JSON.stringify(f.options ?? []), f.sort_order ?? idx, f.id, params.id);
      } else {
        db.prepare(`
          INSERT INTO custom_fields (id, project_id, key, label, type, value, options, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), params.id, f.key, f.label, f.type, f.value ?? '', JSON.stringify(f.options ?? []), f.sort_order ?? idx);
      }
    });
  }

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.id) as Record<string, unknown>;
  const fields = db.prepare('SELECT * FROM custom_fields WHERE project_id = ? ORDER BY sort_order').all(params.id);
  return NextResponse.json({ ...updated, custom_fields: fields });
}

export async function DELETE(_req: Request, { params }: Params) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM projects WHERE id = ?').get(params.id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  db.prepare('DELETE FROM projects WHERE id = ?').run(params.id);
  return NextResponse.json({ success: true });
}
