import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

interface Params { params: { id: string } }

async function checkProjectAccess(projectId: string, userId: string) {
  const db = getDb();
  return db.prepare(`
    SELECT DISTINCT p.* FROM projects p
    LEFT JOIN project_members m ON p.id = m.project_id
    WHERE p.id = ? AND (p.owner_id = ? OR m.user_id = ?)
  `).get(projectId, userId, userId);
}

export async function GET(_req: Request, { params }: Params) {
  let user;
  try {
    user = await requireSession();
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();
    
    const project = db.prepare(`
      SELECT p.* FROM projects p
      LEFT JOIN project_members m ON p.id = m.project_id
      WHERE p.id = ? AND (p.owner_id = ? OR m.user_id = ?)
    `).get(params.id, user.id, user.id) as any;

    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const fields = db.prepare('SELECT * FROM custom_fields WHERE project_id = ? ORDER BY sort_order ASC').all(params.id);
    const members = db.prepare(`
      SELECT m.*, u.email, u.name FROM project_members m
      JOIN users u ON m.user_id = u.id
      WHERE m.project_id = ?
    `).all(params.id);
    const invitations = db.prepare("SELECT * FROM invitations WHERE project_id = ? AND status = 'PENDING'").all(params.id);

    return NextResponse.json({ 
      ...project, 
      custom_fields: fields,
      members: members.map((m: any) => ({ user: { email: m.email, name: m.name }, role: m.role })),
      invitations
    });
  } catch (err) {
    console.error('GET /api/projects/[id] failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await requireSession();
    const db = getDb();
    const projectAccess = await checkProjectAccess(params.id, user.id);
    if (!projectAccess) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as {
      name?: string;
      type?: string;
      phase_key?: string;
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
        options?: string;
        inherited?: number;
        inherited_from?: string | null;
        sort_order?: number;
      }>;
    };

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE projects SET
          name = COALESCE(?, name),
          type = COALESCE(?, type),
          phase_key = COALESCE(?, phase_key),
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
        body.phase_key ?? null,
        body.status ?? null,
        body.target ?? null,
        body.start_date ?? null,
        body.end_date ?? null,
        body.budget ?? null,
        body.channels ? JSON.stringify(body.channels) : null,
        body.description ?? null,
        params.id
      );

      if (body.custom_fields) {
        const incomingIds = body.custom_fields.filter(f => f.id).map(f => f.id!);
        
        if (incomingIds.length > 0) {
          const placeholders = incomingIds.map(() => '?').join(',');
          db.prepare(`DELETE FROM custom_fields WHERE project_id = ? AND id NOT IN (${placeholders})`).run(params.id, ...incomingIds);
        } else {
          db.prepare('DELETE FROM custom_fields WHERE project_id = ?').run(params.id);
        }

        body.custom_fields.forEach((f, idx) => {
          if (f.id) {
            db.prepare(`
              UPDATE custom_fields SET
                key = ?, label = ?, type = ?, value = ?, options = ?, inherited = ?, inherited_from = ?, sort_order = ?
              WHERE id = ?
            `).run(f.key, f.label, f.type, f.value ?? '', f.options ?? '{}', f.inherited ?? 0, f.inherited_from ?? null, f.sort_order ?? idx, f.id);
          } else {
            db.prepare(`
              INSERT INTO custom_fields (id, project_id, key, label, type, value, options, inherited, inherited_from, sort_order)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(uuidv4(), params.id, f.key, f.label, f.type, f.value ?? '', f.options ?? '{}', f.inherited ?? 0, f.inherited_from ?? null, f.sort_order ?? idx);
          }
        });
      }
    });
    tx();

    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.id);
    const fields = db.prepare('SELECT * FROM custom_fields WHERE project_id = ? ORDER BY sort_order ASC').all(params.id);
    return NextResponse.json({ ...updated as any, custom_fields: fields });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireSession();
    const db = getDb();
    const project = db.prepare('SELECT owner_id FROM projects WHERE id = ?').get(params.id) as any;
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (project.owner_id !== user.id) return NextResponse.json({ error: 'Only owners can delete projects' }, { status: 403 });

    db.prepare('DELETE FROM projects WHERE id = ?').run(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
