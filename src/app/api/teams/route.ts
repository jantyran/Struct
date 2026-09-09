import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthSession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import type { Team } from '@/types';

/** 組織内のチーム一覧取得 */
export async function GET() {
  const { user, errorResponse } = await getAuthSession();
  if (errorResponse) return errorResponse;

  const db = getDb();
  try {
    const teams = db.prepare(`
      SELECT t.*,
             (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) AS member_count
      FROM teams t
      WHERE t.organization_id = ?
      ORDER BY t.created_at ASC
    `).all(user.organization_id) as Array<Team & { member_count: number }>;

    return NextResponse.json(teams);
  } catch (err) {
    console.error('GET /api/teams failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** チーム新規作成 */
export async function POST(req: Request) {
  const { user, errorResponse } = await getAuthSession();
  if (errorResponse) return errorResponse;

  if (!user.organization_id) {
    return NextResponse.json({ error: '組織に所属していません' }, { status: 400 });
  }

  let body: { name?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = (body.name ?? '').trim();
  const description = (body.description ?? '').trim();

  if (!name) {
    return NextResponse.json({ error: 'チーム名は必須です' }, { status: 400 });
  }

  const db = getDb();
  try {
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO teams (id, organization_id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, user.organization_id, name, description, now, now);

    // 作成者をリーダーとして自動追加
    const memberId = uuidv4();
    db.prepare(`
      INSERT INTO team_members (id, team_id, user_id, role, created_at)
      VALUES (?, ?, ?, 'LEADER', ?)
    `).run(memberId, id, user.id, now);

    const created = db.prepare(`
      SELECT t.*,
             (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) AS member_count
      FROM teams t
      WHERE t.id = ?
    `).get(id) as Team & { member_count: number };

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('POST /api/teams failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
