import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { generateText } from '@/lib/ai/client';
import { buildProjectContext, buildAssetPrompt, extractWarnings, SYSTEM_PROMPT } from '@/lib/ai/prompt-builder';
import { requireSession } from '@/lib/auth';
import type { AssetType, ProjectWithFields, GlobalAssets } from '@/types';
import { ASSET_TYPE_LABELS } from '@/types';

interface Params { params: { id: string } }

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireSession();
    const body = await request.json() as { asset_types: AssetType[] };

    if (!body.asset_types?.length) {
      return NextResponse.json({ error: 'asset_types が必要です' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
      },
      include: { customFields: { orderBy: { sortOrder: 'asc' } } }
    });

    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const globalAssetsRow = await prisma.globalAssets.findUnique({
      where: { userId: user.id }
    });

    if (!globalAssetsRow) return NextResponse.json({ error: 'Global assets missing' }, { status: 500 });

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
      company_name: globalAssetsRow.companyName || '',
      company_description: globalAssetsRow.companyDescription || '',
      brand_voice: globalAssetsRow.brandVoice || '',
      brand_guidelines: globalAssetsRow.brandGuidelines || '',
      products: JSON.parse(globalAssetsRow.products || '[]'),
      updated_at: globalAssetsRow.updatedAt.toISOString(),
    };

    const context = buildProjectContext(typedProject, typedGlobal);
    const results = [];

    for (const assetType of body.asset_types) {
      const prompt = buildAssetPrompt(assetType, context);
      const content = await generateText(prompt, SYSTEM_PROMPT, 4096);
      const warnings = extractWarnings(content);

      const title = `${ASSET_TYPE_LABELS[assetType]} — ${new Date().toLocaleDateString('ja-JP')}`;

      const asset = await prisma.generatedAsset.create({
        data: {
          projectId: params.id,
          assetType,
          title,
          content,
          warnings: JSON.stringify(warnings),
        }
      });

      results.push({ ...asset, asset_type: asset.assetType, warnings });
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
