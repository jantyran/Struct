import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { generateText } from '@/lib/ai/client';
import {
  buildProjectContext,
  buildCompletionPrompt,
  parseCompletionResponse,
  SYSTEM_PROMPT,
} from '@/lib/ai/prompt-builder';
import { requireSession } from '@/lib/auth';
import type { ProjectWithFields, GlobalAssets } from '@/types';
import { normalizeGlobalAssetsRow } from '@/lib/global-assets';
import { normalizeAISettingsRow } from '@/lib/ai/settings';

interface Params { params: { id: string } }

export async function POST(_req: Request, { params }: Params) {
  let user;
  try {
    user = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();

    const project = db.prepare(`
      SELECT p.* FROM projects p
      LEFT JOIN project_members m ON p.id = m.project_id
      WHERE p.id = ? AND (p.owner_id = ? OR m.user_id = ?)
    `).get(params.id, user.id, user.id) as any;

    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const fields = db.prepare('SELECT * FROM custom_fields WHERE project_id = ? ORDER BY sort_order ASC').all(params.id) as any[];

    let globalAssetsRow = db.prepare('SELECT * FROM global_assets WHERE user_id = ?').get(user.id) as any;
    if (!globalAssetsRow) {
      const assetsId = uuidv4();
      db.prepare('INSERT INTO global_assets (id, user_id) VALUES (?, ?)').run(assetsId, user.id);
      globalAssetsRow = db.prepare('SELECT * FROM global_assets WHERE id = ?').get(assetsId) as any;
    }

    const typedProject: ProjectWithFields = {
      ...project,
      custom_fields: fields.map(f => ({
        ...f,
        options: f.options || '{}',
        value: f.value || '',
        is_builtin: f.is_builtin ?? 0,
        section: f.section ?? '',
      })),
      cloned_from: project.cloned_from,
    };

    const typedGlobal: GlobalAssets = normalizeGlobalAssetsRow(globalAssetsRow);
    const aiSettings = normalizeAISettingsRow(globalAssetsRow);

    const emptyFields = typedProject.custom_fields.filter(f => !f.value?.trim());
    if (emptyFields.length === 0) {
      return NextResponse.json({ suggestions: [], message: '補完対象フィールドがありません' });
    }

    const prompt = buildCompletionPrompt(typedProject, typedGlobal, emptyFields);
    const raw = await generateText(prompt, SYSTEM_PROMPT, 2048, aiSettings);
    const suggestions = parseCompletionResponse(raw);

    return NextResponse.json({ suggestions, raw_response: raw });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Completion failed' }, { status: 500 });
  }
}
