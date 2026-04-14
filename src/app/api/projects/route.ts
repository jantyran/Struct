import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { requireSession } from '@/lib/auth';

export async function GET() {
  try {
    const user = await requireSession();
    const db = getDb();
    
    // 自身がオーナーまたはメンバーであるプロジェクトを抽出
    const projects = db.prepare(`
      SELECT DISTINCT p.* FROM projects p
      LEFT JOIN project_members m ON p.id = m.project_id
      WHERE p.owner_id = ? OR m.user_id = ?
      ORDER BY p.updated_at DESC
    `).all(user.id, user.id);

    return NextResponse.json(projects);
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSession();
    const db = getDb();
    const body = await request.json() as {
      name: string;
      type?: string;
      phase_key?: string;
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
        options?: string;
        inherited?: number;
        inherited_from?: string | null;
        sort_order?: number;
      }>;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'name は必須です' }, { status: 400 });
    }

    const id = uuidv4();
    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO projects (id, name, type, phase_key, target, start_date, end_date, budget, channels, description, owner_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        body.name.trim(),
        body.type ?? 'campaign',
        body.phase_key ?? '',
        body.target ?? '',
        body.start_date ?? '',
        body.end_date ?? '',
        body.budget ?? '',
        JSON.stringify(body.channels ?? []),
        body.description ?? '',
        user.id
      );

      (body.custom_fields ?? []).forEach((field, index) => {
        db.prepare(`
          INSERT INTO custom_fields (id, project_id, key, label, type, value, options, inherited, inherited_from, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          field.id ?? uuidv4(),
          id,
          field.key,
          field.label,
          field.type,
          field.value ?? '',
          field.options ?? '{}',
          field.inherited ?? 0,
          field.inherited_from ?? null,
          field.sort_order ?? index
        );
      });
    });
    tx();

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
