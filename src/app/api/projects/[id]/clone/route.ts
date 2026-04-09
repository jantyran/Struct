import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireSession } from '@/lib/auth';

interface Params { params: { id: string } }

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireSession();
    const body = await request.json() as { new_name: string; include_values: boolean };

    if (!body.new_name?.trim()) {
      return NextResponse.json({ error: 'new_name は必須です' }, { status: 400 });
    }

    const source = await prisma.project.findFirst({
      where: {
        id: params.id,
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id } } },
        ],
      },
      include: { customFields: true }
    });

    if (!source) return NextResponse.json({ error: 'Source project not found' }, { status: 404 });

    const cloned = await prisma.project.create({
      data: {
        name: body.new_name.trim(),
        type: source.type,
        status: 'draft',
        clonedFrom: params.id,
        target: body.include_values ? source.target : '',
        startDate: body.include_values ? source.startDate : '',
        endDate: body.include_values ? source.endDate : '',
        budget: body.include_values ? source.budget : '',
        channels: body.include_values ? source.channels : '[]',
        description: body.include_values ? source.description : '',
        ownerId: user.id,
        members: { create: { userId: user.id, role: 'OWNER' } },
        customFields: {
          create: source.customFields.map(f => ({
            key: f.key,
            label: f.label,
            type: f.type,
            value: body.include_values ? f.value : '',
            options: f.options,
            inherited: body.include_values && f.value ? 1 : 0,
            inheritedFrom: body.include_values && f.value ? params.id : null,
            sortOrder: f.sortOrder,
          }))
        }
      },
      include: { customFields: true }
    });

    return NextResponse.json(cloned, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
