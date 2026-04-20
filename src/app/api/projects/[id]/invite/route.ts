import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { requireSession } from '@/lib/auth';
import { BASE_PATH } from '@/lib/paths';
import { normalizeProjectMemberRole } from '@/lib/permissions';

interface Params { params: { id: string } }

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireSession();
    const db = getDb();
    const { email, role } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "招待メールアドレスが必要です" }, { status: 400 });
    }

    const project = db.prepare('SELECT owner_id FROM projects WHERE id = ? AND organization_id = ?').get(params.id, user.organization_id) as any;
    if (!project || project.owner_id !== user.id) {
      return NextResponse.json({ error: "オーナーのみ招待可能です" }, { status: 403 });
    }

    const token = uuidv4();
    const inviteRole = normalizeProjectMemberRole(role);
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + 7); // 7日間有効

    db.prepare(`
      INSERT INTO invitations (id, project_id, email, token, role, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), params.id, email.toLowerCase(), token, inviteRole, expires_at.toISOString());

    const inviteUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:38427'}${BASE_PATH}/invites/${token}`;
    return NextResponse.json({ success: true, inviteUrl });
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
