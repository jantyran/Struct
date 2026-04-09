import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { generateText } from '@/lib/ai/client';
import { buildProjectContext, buildAssetPrompt, extractWarnings, SYSTEM_PROMPT } from '@/lib/ai/prompt-builder';
import type { AssetType, ProjectWithFields, GlobalAssets, CustomField } from '@/types';
import { ASSET_TYPE_LABELS } from '@/types';

interface Params { params: { id: string } }

export async function POST(request: Request, { params }: Params) {
  const db = getDb();
  const body = await request.json() as { asset_types: AssetType[] };

  if (!body.asset_types?.length) {
    return NextResponse.json({ error: 'asset_types が必要です' }, { status: 400 });
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.id) as ProjectWithFields | undefined;
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const fields = db.prepare('SELECT * FROM custom_fields WHERE project_id = ? ORDER BY sort_order').all(params.id) as CustomField[];
  project.custom_fields = fields;

  const globalRow = db.prepare('SELECT * FROM global_assets WHERE id = ?').get('main') as Record<string, unknown>;
  const globalAssets: GlobalAssets = {
    ...(globalRow as Omit<GlobalAssets, 'products'>),
    products: JSON.parse((globalRow.products as string) || '[]'),
  };

  const context = buildProjectContext(project, globalAssets);
  const results: { asset_type: AssetType; asset_id: string; title: string; content: string; warnings: string[] }[] = [];

  for (const assetType of body.asset_types) {
    const prompt = buildAssetPrompt(assetType, context);
    const content = await generateText(prompt, SYSTEM_PROMPT, 4096);
    const warnings = extractWarnings(content);

    const assetId = uuidv4();
    const title = `${ASSET_TYPE_LABELS[assetType]} — ${new Date().toLocaleDateString('ja-JP')}`;

    db.prepare(`
      INSERT INTO generated_assets (id, project_id, asset_type, title, content, warnings)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(assetId, params.id, assetType, title, content, JSON.stringify(warnings));

    results.push({ asset_type: assetType, asset_id: assetId, title, content, warnings });
  }

  return NextResponse.json({ results });
}
