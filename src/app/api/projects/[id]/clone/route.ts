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

    const sourceFields = db.prepare('SELECT * FROM custom_fields WHERE project_id = ? ORDER BY sort_order ASC').all(params.id) as any[];

    const newId = uuidv4();

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO projects (id, name, type, phase_key, status, owner_id, primary_assignee_id, cloned_from)
        VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)
      `).run(
        newId,
        body.new_name.trim(),
        source.type,
        source.phase_key || '',
        user.id,
        user.id,
        params.id,
      );

      // 全フィールド（組み込み + カスタム）をクローン
      for (const field of sourceFields) {
        db.prepare(`
          INSERT INTO custom_fields
            (id, project_id, template_id, key, label, type, value, options, layout,
             inherited, inherited_from, crawled_content, sort_order, is_builtin, section)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          uuidv4(),
          newId,
          field.template_id ?? null,
          field.key,
          field.label,
          field.type,
          body.include_values ? field.value : '',
          field.options,
          field.layout === 'full' ? 'full' : 'half',
          body.include_values && field.value ? 1 : 0,
          body.include_values && field.value ? params.id : null,
          body.include_values ? (field.crawled_content ?? null) : null,
          field.sort_order,
          field.is_builtin ?? 0,
          field.section ?? '',
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
