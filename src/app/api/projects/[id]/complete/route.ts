import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateText } from '@/lib/ai/client';
import {
  buildCompletionPrompt,
  parseCompletionResponse,
  SYSTEM_PROMPT,
} from '@/lib/ai/prompt-builder';
import { requireSession } from '@/lib/auth';
import type { ProjectWithFields, GlobalAssets } from '@/types';
import { normalizeGlobalAssetsRow } from '@/lib/global-assets';
import { normalizeAISettingsRow } from '@/lib/ai/settings';
import { normalizeProjectTypeDefinitionsRow } from '@/lib/project-types';
import { requireProjectPermission } from '@/lib/permissions';
import { getOrganizationSettingsRow } from '@/lib/organization-settings';

interface Params { params: { id: string } }

export async function POST(req: Request, { params }: Params) {
  let user;
  try {
    user = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let additionalInstruction = '';
  let noteIds: string[] = [];
  try {
    const body = await req.json() as { additionalInstruction?: string; noteIds?: string[] };
    additionalInstruction = body.additionalInstruction ?? '';
    noteIds = body.noteIds ?? [];
  } catch { /* body なし or JSON パース失敗は無視 */ }

  try {
    const db = getDb();

    const project = db.prepare(`
      SELECT p.* FROM projects p
      LEFT JOIN project_members m ON p.id = m.project_id
      WHERE p.id = ? AND p.organization_id = ? AND (p.owner_id = ? OR m.user_id = ?)
    `).get(params.id, user.organization_id, user.id, user.id) as any;

    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!requireProjectPermission(db, params.id, user.id, 'generate_content')) {
      return NextResponse.json({ error: '生成権限がありません' }, { status: 403 });
    }

    const fields = db.prepare('SELECT * FROM custom_fields WHERE project_id = ? ORDER BY sort_order ASC').all(params.id) as any[];
    const notes = db.prepare('SELECT * FROM project_notes WHERE project_id = ? ORDER BY pinned DESC, updated_at DESC').all(params.id) as any[];
    const generatedAssets = db.prepare('SELECT * FROM generated_assets WHERE project_id = ? ORDER BY datetime(created_at) DESC').all(params.id) as any[];

    const globalAssetsRow = getOrganizationSettingsRow(db, user.organization_id);
    const projectTypes = normalizeProjectTypeDefinitionsRow(globalAssetsRow);
    const currentProjectType = projectTypes.find((definition) => definition.key === project.type);

    const typedProject: ProjectWithFields = {
      ...project,
      custom_fields: fields.map(f => ({
        ...f,
        template_id: f.template_id || currentProjectType?.field_templates.find((ft: { key: string; id: string }) => ft.key === f.key)?.id,
        options: f.options || '{}',
        value: f.value || '',
        is_builtin: f.is_builtin ?? 0,
        section: f.section ?? '',
      })),
      project_notes: notes,
      generated_assets: generatedAssets,
      cloned_from: project.cloned_from,
    };

    const typedGlobal: GlobalAssets = normalizeGlobalAssetsRow(globalAssetsRow);
    const aiSettings = normalizeAISettingsRow(globalAssetsRow);

    const emptyFields = typedProject.custom_fields.filter(f => !f.value?.trim());
    if (emptyFields.length === 0) {
      return NextResponse.json({ suggestions: [], message: '補完対象フィールドがありません' });
    }

    const referenceNotes = noteIds.length > 0
      ? (db.prepare(
          `SELECT * FROM project_notes WHERE project_id = ? AND id IN (${noteIds.map(() => '?').join(',')}) ORDER BY created_at ASC`
        ).all(params.id, ...noteIds) as any[])
      : [];

    const prompt = buildCompletionPrompt(typedProject, typedGlobal, emptyFields, additionalInstruction, referenceNotes);
    const raw = await generateText(prompt, SYSTEM_PROMPT, 4096, aiSettings);
    const suggestions = parseCompletionResponse(raw);

    return NextResponse.json({ suggestions, raw_response: raw });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Completion failed' }, { status: 500 });
  }
}
