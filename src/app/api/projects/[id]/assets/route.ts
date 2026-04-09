import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireSession } from '@/lib/auth';

interface Params { params: { id: string } }

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireSession();
    const assets = await prisma.generatedAsset.findMany({
      where: {
        projectId: params.id,
        project: {
          OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }]
        }
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return NextResponse.json(assets.map(a => ({ ...a, asset_type: a.assetType, created_at: a.createdAt })));
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const user = await requireSession();
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId');

    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }]
      }
    });
    if (!project) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!assetId) {
      await prisma.generatedAsset.deleteMany({
        where: { projectId: params.id }
      });
    } else {
      await prisma.generatedAsset.delete({
        where: { id: assetId, projectId: params.id }
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
