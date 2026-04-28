import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { requireProjectPermission } from '@/lib/permissions';
import { v4 as uuidv4 } from 'uuid';

interface Params { params: Promise<{ id: string }> }

function projectContacts(db: ReturnType<typeof getDb>, projectId: string) {
  return db.prepare(`
    SELECT id, name, email, phone, company_name, created_at, updated_at
    FROM project_contacts
    WHERE project_id = ?
    ORDER BY datetime(created_at) ASC, rowid ASC
  `).all(projectId);
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  try {
    const user = await requireSession();
    const db = getDb();
    if (!requireProjectPermission(db, params.id, user.id, 'manage_members')) {
      return NextResponse.json({ error: 'メンバー管理権限がありません' }, { status: 403 });
    }

    const body = await request.json() as { name?: string; email?: string; phone?: string; company_name?: string };
    const name = normalizeText(body.name);
    const email = normalizeText(body.email);
    const phone = normalizeText(body.phone);
    const companyName = normalizeText(body.company_name);

    if (!name) {
      return NextResponse.json({ error: '名前は必須です' }, { status: 400 });
    }

    db.prepare(`
      INSERT INTO project_contacts (id, project_id, name, email, phone, company_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), params.id, name, email, phone, companyName);

    return NextResponse.json({ contacts: projectContacts(db, params.id) });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function PATCH(request: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  try {
    const user = await requireSession();
    const db = getDb();
    if (!requireProjectPermission(db, params.id, user.id, 'manage_members')) {
      return NextResponse.json({ error: 'メンバー管理権限がありません' }, { status: 403 });
    }

    const body = await request.json() as { id?: string; name?: string; email?: string; phone?: string; company_name?: string };
    const contactId = normalizeText(body.id);
    const name = normalizeText(body.name);
    const email = normalizeText(body.email);
    const phone = normalizeText(body.phone);
    const companyName = normalizeText(body.company_name);

    if (!contactId) {
      return NextResponse.json({ error: 'id が必要です' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: '名前は必須です' }, { status: 400 });
    }

    const updated = db.prepare(`
      UPDATE project_contacts
      SET name = ?, email = ?, phone = ?, company_name = ?, updated_at = datetime('now')
      WHERE id = ? AND project_id = ?
    `).run(name, email, phone, companyName, contactId, params.id);

    if (updated.changes === 0) {
      return NextResponse.json({ error: '関係者が見つかりません' }, { status: 404 });
    }

    return NextResponse.json({ contacts: projectContacts(db, params.id) });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function DELETE(request: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  try {
    const user = await requireSession();
    const db = getDb();
    if (!requireProjectPermission(db, params.id, user.id, 'manage_members')) {
      return NextResponse.json({ error: 'メンバー管理権限がありません' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const contactId = normalizeText(searchParams.get('id'));
    if (!contactId) {
      return NextResponse.json({ error: 'id が必要です' }, { status: 400 });
    }

    const deleted = db.prepare('DELETE FROM project_contacts WHERE id = ? AND project_id = ?').run(contactId, params.id);
    if (deleted.changes === 0) {
      return NextResponse.json({ error: '関係者が見つかりません' }, { status: 404 });
    }

    return NextResponse.json({ contacts: projectContacts(db, params.id) });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
