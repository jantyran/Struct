import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import type { CustomField } from '@/types';

interface Params { params: { id: string } }

export async function POST(request: Request, { params }: Params) {
  const db = getDb();
  const body = await request.json() as { new_name: string; include_values: boolean };

  if (!body.new_name?.trim()) {
    return NextResponse.json({ error: 'new_name は必須です' }, { status: 400 });
  }

  const source = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.id) as Record<string, unknown> | undefined;
  if (!source) return NextResponse.json({ error: 'Source project not found' }, { status: 404 });

  const sourceFields = db.prepare('SELECT * FROM custom_fields WHERE project_id = ? ORDER BY sort_order').all(params.id) as CustomField[];

  const newId = uuidv4();

  db.prepare(`
    INSERT INTO projects (id, name, type, status, cloned_from, target, start_date, end_date, budget, channels, description)
    VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newId,
    body.new_name.trim(),
    source.type,
    params.id, // cloned_from
    body.include_values ? source.target : '',
    body.include_values ? source.start_date : '',
    body.include_values ? source.end_date : '',
    body.include_values ? source.budget : '',
    body.include_values ? source.channels : '[]',
    body.include_values ? source.description : '',
  );

  // カスタムフィールドの複製（値を含むか否か + inheritedフラグ）
  for (const field of sourceFields) {
    db.prepare(`
      INSERT INTO custom_fields (id, project_id, key, label, type, value, options, inherited, inherited_from, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      newId,
      field.key,
      field.label,
      field.type,
      body.include_values ? field.value : '',
      field.options,
      body.include_values && field.value ? 1 : 0, // 値を持つ場合は「継承・要確認」フラグ
      body.include_values && field.value ? params.id : null,
      field.sort_order,
    );
  }

  const cloned = db.prepare('SELECT * FROM projects WHERE id = ?').get(newId) as Record<string, unknown>;
  const clonedFields = db.prepare('SELECT * FROM custom_fields WHERE project_id = ? ORDER BY sort_order').all(newId);
  return NextResponse.json({ ...cloned, custom_fields: clonedFields }, { status: 201 });
}
