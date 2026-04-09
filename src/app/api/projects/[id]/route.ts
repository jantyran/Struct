import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireSession } from '@/lib/auth';

interface Params { params: { id: string } }

async function checkProjectAccess(projectId: string, userId: string) {
  return await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
  });
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireSession();
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id } } },
        ],
      },
      include: {
        customFields: { orderBy: { sortOrder: 'asc' } },
        members: { include: { user: { select: { email: true, name: true } } } },
        invitations: { where: { status: 'PENDING' } }
      },
    });

    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    
    // Map customFields to match existing UI expectation
    const { customFields, ...rest } = project;
    return NextResponse.json({ ...rest, custom_fields: customFields });
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await requireSession();
    const projectAccess = await checkProjectAccess(params.id, user.id);
    if (!projectAccess) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as {
      name?: string;
      type?: string;
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
        options?: string[];
        inherited?: number;
        sort_order?: number;
      }>;
    };

    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: params.id },
        data: {
          name: body.name,
          type: body.type,
          status: body.status,
          target: body.target,
          startDate: body.start_date,
          endDate: body.end_date,
          budget: body.budget,
          channels: body.channels ? JSON.stringify(body.channels) : undefined,
          description: body.description,
        },
      });

      if (body.custom_fields) {
        const incomingIds = body.custom_fields.filter(f => f.id).map(f => f.id!);
        
        // Delete
        await tx.customField.deleteMany({
          where: {
            projectId: params.id,
            id: { notIn: incomingIds }
          }
        });

        // Upsert
        for (const [idx, f] of body.custom_fields.entries()) {
          if (f.id) {
            await tx.customField.update({
              where: { id: f.id },
              data: {
                key: f.key,
                label: f.label,
                type: f.type,
                value: f.value ?? '',
                options: JSON.stringify(f.options ?? []),
                sortOrder: f.sort_order ?? idx,
              }
            });
          } else {
            await tx.customField.create({
              data: {
                projectId: params.id,
                key: f.key,
                label: f.label,
                type: f.type,
                value: f.value ?? '',
                options: JSON.stringify(f.options ?? []),
                sortOrder: f.sort_order ?? idx,
              }
            });
          }
        }
      }
    });

    const updated = await prisma.project.findUnique({
      where: { id: params.id },
      include: { customFields: { orderBy: { sortOrder: 'asc' } } }
    });
    
    const { customFields, ...rest } = updated!;
    return NextResponse.json({ ...rest, custom_fields: customFields });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireSession();
    const project = await prisma.project.findUnique({ where: { id: params.id } });
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (project.ownerId !== user.id) return NextResponse.json({ error: 'Only owners can delete projects' }, { status: 403 });

    await prisma.project.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
