import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

interface Params { params: Promise<{ token: string }> }

export async function GET(_req: Request, { params: routeParams }: Params) {
  const params = await routeParams;
  const db = getDb();
  const invitation = db.prepare(`
    SELECT i.*, p.name as project_name FROM invitations i
    JOIN projects p ON i.project_id = p.id
    WHERE i.token = ?
  `).get(params.token) as any;

  if (!invitation) return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
  if (invitation.status !== 'PENDING') return NextResponse.json({ error: 'Already accepted or declined' }, { status: 400 });
  if (new Date(invitation.expires_at) < new Date()) return NextResponse.json({ error: 'Invitation expired' }, { status: 400 });

  return NextResponse.json({ ...invitation, project: { name: invitation.project_name } });
}
