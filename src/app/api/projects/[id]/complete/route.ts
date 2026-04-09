import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateText } from '@/lib/ai/client';
import {
  buildProjectContext,
  buildCompletionPrompt,
  parseCompletionResponse,
  SYSTEM_PROMPT,
} from '@/lib/ai/prompt-builder';
import type { ProjectWithFields, GlobalAssets, CustomField } from '@/types';

interface Params { params: { id: string } }

export async function POST(_req: Request, { params }: Params) {
  const db = getDb();

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.id) as ProjectWithFields | undefined;
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const fields = db.prepare('SELECT * FROM custom_fields WHERE project_id = ? ORDER BY sort_order').all(params.id) as CustomField[];
  project.custom_fields = fields;

  const globalRow = db.prepare('SELECT * FROM global_assets WHERE id = ?').get('main') as Record<string, unknown>;
  const globalAssets: GlobalAssets = {
    ...(globalRow as Omit<GlobalAssets, 'products'>),
    products: JSON.parse((globalRow.products as string) || '[]'),
  };

  const emptyFields = fields.filter(f => !f.value?.trim());
  if (emptyFields.length === 0) {
    return NextResponse.json({ suggestions: [], message: '補完対象フィールドがありません' });
  }

  const prompt = buildCompletionPrompt(project, globalAssets, emptyFields);
  const raw = await generateText(prompt, SYSTEM_PROMPT, 2048);
  const suggestions = parseCompletionResponse(raw);

  return NextResponse.json({ suggestions, raw_response: raw });
}
