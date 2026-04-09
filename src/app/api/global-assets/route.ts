import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireSession } from '@/lib/auth';

export async function GET() {
  try {
    const user = await requireSession();
    let assets = await prisma.globalAssets.findUnique({
      where: { userId: user.id },
    });

    if (!assets) {
      assets = await prisma.globalAssets.create({
        data: { userId: user.id },
      });
    }

    return NextResponse.json(assets);
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireSession();
    const body = await request.json() as {
      company_name?: string;
      company_description?: string;
      brand_voice?: string;
      brand_guidelines?: string;
      products?: any[];
    };

    const updated = await prisma.globalAssets.update({
      where: { userId: user.id },
      data: {
        companyName: body.company_name,
        companyDescription: body.company_description,
        brandVoice: body.brand_voice,
        brandGuidelines: body.brand_guidelines,
        products: body.products ? JSON.stringify(body.products) : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
