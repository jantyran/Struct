import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

interface Params { params: { token: string } }

export async function GET(_req: Request, { params }: Params) {
  const invitation = await prisma.invitation.findUnique({
    where: { token: params.token },
    include: { project: { select: { name: true } } }
  });

  if (!invitation) return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
  if (invitation.status !== 'PENDING') return NextResponse.json({ error: 'Already accepted or declined' }, { status: 400 });
  if (invitation.expiresAt < new Date()) return NextResponse.json({ error: 'Invitation expired' }, { status: 400 });

  return NextResponse.json(invitation);
}
