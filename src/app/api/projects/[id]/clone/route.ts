import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { requireSession } from '@/lib/auth';

interface Params { params: { id: string } }

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireSession();
    const db = getDb();
    const body = await request.json() as { new_name: string; include_values: boolean };

    if (!body.new_name?.trim()) {
      return NextResponse.json({ error: 'new_name は必須です' }, { status: 400 });
    }

    const source = db.prepare(`
      SELECT p.* FROM projects p
      LEFT JOIN project_members m ON p.id = m.project_id
      WHERE p.id = ? AND (p.owner_id = ? OR m.user_id = ?)
    `).get(params.id, user.id, user.id) as any;

    if (!source) return NextResponse.json({ error: 'Source project not found' }, { status: 404 });

    const sourceFields = db.prepare('SELECT * FROM custom_fields WHERE project_id = ?').all(params.id) as any[];

    const newId = uuidv4();

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO projects (id, name, type, phase_key, status, owner_id, cloned_from, target, start_date, end_date, budget, channels, description)
        VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newId,
        body.new_name.trim(),
        source.type,
        source.phase_key || '',
        user.id,
        params.id,
        body.include_values ? source.target : '',
        body.include_values ? source.start_date : '',
        body.include_values ? source.end_date : '',
        body.include_values ? source.budget : '',
        body.include_values ? source.channels : '[]',
        body.include_values ? source.description : '',
      );

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
          body.include_values && field.value ? 1 : 0,
          body.include_values && field.value ? params.id : null,
          field.sort_order,
        );
      }
    });
    tx();

    const cloned = db.prepare('SELECT * FROM projects WHERE id = ?').get(newId);
    return NextResponse.json(cloned, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
