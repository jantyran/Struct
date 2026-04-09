import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { generateText } from '@/lib/ai/client';
import {
  buildProjectContext,
  buildCompletionPrompt,
  parseCompletionResponse,
  SYSTEM_PROMPT,
} from '@/lib/ai/prompt-builder';
import { requireSession } from '@/lib/auth';
import type { ProjectWithFields, GlobalAssets, CustomField } from '@/types';

interface Params { params: { id: string } }

export async function POST(_req: Request, { params }: Params) {
  try {
    const user = await requireSession();
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
      },
      include: { customFields: { orderBy: { sortOrder: 'asc' } } }
    });

    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const globalAssets = await prisma.globalAssets.findUnique({
      where: { userId: user.id }
    });

    if (!globalAssets) return NextResponse.json({ error: 'Global assets missing' }, { status: 500 });

    const typedProject: ProjectWithFields = {
      ...project,
      custom_fields: project.customFields.map(f => ({
        ...f,
        project_id: f.projectId,
        inherited_from: f.inheritedFrom,
        crawled_content: f.crawledContent,
        sort_order: f.sortOrder,
        options: f.options || '[]',
        value: f.value || '',
      })),
      channels: project.channels || '[]',
      target: project.target || '',
      start_date: project.startDate || '',
      end_date: project.endDate || '',
      budget: project.budget || '',
      description: project.description || '',
      cloned_from: project.clonedFrom,
      created_at: project.createdAt.toISOString(),
      updated_at: project.updatedAt.toISOString(),
      status: project.status as any,
      type: project.type as any,
    };

    const typedGlobal: GlobalAssets = {
      company_name: globalAssets.companyName || '',
      company_description: globalAssets.companyDescription || '',
      brand_voice: globalAssets.brandVoice || '',
      brand_guidelines: globalAssets.brandGuidelines || '',
      products: JSON.parse(globalAssets.products || '[]'),
      updated_at: globalAssets.updatedAt.toISOString(),
    };

    const emptyFields = typedProject.custom_fields.filter(f => !f.value?.trim());
    if (emptyFields.length === 0) {
      return NextResponse.json({ suggestions: [], message: '補完対象フィールドがありません' });
    }

    const prompt = buildCompletionPrompt(typedProject, typedGlobal, emptyFields);
    const raw = await generateText(prompt, SYSTEM_PROMPT, 2048);
    const suggestions = parseCompletionResponse(raw);

    return NextResponse.json({ suggestions, raw_response: raw });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
