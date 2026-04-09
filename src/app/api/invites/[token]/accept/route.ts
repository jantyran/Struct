import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

interface Params { params: { token: string } }

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireSession();
    const db = getDb();
    
    const invitation = db.prepare(`
      SELECT * FROM invitations WHERE token = ? AND status = 'PENDING'
    `).get(params.token) as any;

    if (!invitation) {
      return NextResponse.json({ error: "有効な招待が見つかりません" }, { status: 404 });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: "招待の有効期限が切れています" }, { status: 400 });
    }

    if (invitation.email !== user.email.toLowerCase()) {
      return NextResponse.json({ error: "この招待は別のメールアドレス宛です" }, { status: 403 });
    }

    // トランザクションで処理
    const tx = db.transaction(() => {
      db.prepare(`
        INSERT OR IGNORE INTO project_members (id, project_id, user_id, role)
        VALUES (?, ?, ?, ?)
      `).run(uuidv4(), invitation.project_id, user.id, invitation.role);

      db.prepare(`
        UPDATE invitations SET status = 'ACCEPTED' WHERE id = ?
      `).run(invitation.id);
    });
    tx();

    return NextResponse.json({ success: true, projectId: invitation.project_id });
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
