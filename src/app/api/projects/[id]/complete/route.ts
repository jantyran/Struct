import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateText } from '@/lib/ai/client';
import {
  buildProjectContext,
  buildCompletionPrompt,
  parseCompletionResponse,
  SYSTEM_PROMPT,
} from '@/lib/ai/prompt-builder';
import { requireSession } from '@/lib/auth';
import type { ProjectWithFields, GlobalAssets } from '@/types';

interface Params { params: { id: string } }

export async function POST(_req: Request, { params }: Params) {
  try {
    const user = await requireSession();
    const db = getDb();

    const project = db.prepare(`
      SELECT p.* FROM projects p
      LEFT JOIN project_members m ON p.id = m.project_id
      WHERE p.id = ? AND (p.owner_id = ? OR m.user_id = ?)
    `).get(params.id, user.id, user.id) as any;

    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const fields = db.prepare('SELECT * FROM custom_fields WHERE project_id = ? ORDER BY sort_order ASC').all(params.id) as any[];

    const globalAssetsRow = db.prepare('SELECT * FROM global_assets WHERE user_id = ?').get(user.id) as any;
    if (!globalAssetsRow) return NextResponse.json({ error: 'Global assets missing' }, { status: 500 });

    const typedProject: ProjectWithFields = {
      ...project,
      custom_fields: fields.map(f => ({
        ...f,
        project_id: f.project_id,
        inherited_from: f.inherited_from,
        crawled_content: f.crawled_content,
        sort_order: f.sort_order,
        options: f.options || '[]',
        value: f.value || '',
      })),
      channels: project.channels || '[]',
      target: project.target || '',
      start_date: project.start_date || '',
      end_date: project.end_date || '',
      budget: project.budget || '',
      description: project.description || '',
      cloned_from: project.cloned_from,
      created_at: project.created_at,
      updated_at: project.updated_at,
      status: project.status,
      type: project.type,
    };

    const typedGlobal: GlobalAssets = {
      company_name: globalAssetsRow.company_name || '',
      company_description: globalAssetsRow.company_description || '',
      brand_voice: globalAssetsRow.brand_voice || '',
      brand_guidelines: globalAssetsRow.brand_guidelines || '',
      products: JSON.parse(globalAssetsRow.products || '[]'),
      updated_at: globalAssetsRow.updated_at,
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
