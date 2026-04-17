import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { generateText } from '@/lib/ai/client';
import { buildProjectContext, buildContentPrompt, extractWarnings, SYSTEM_PROMPT } from '@/lib/ai/prompt-builder';
import { requireSession } from '@/lib/auth';
import type { AssetType, ProjectWithFields, GlobalAssets } from '@/types';
import { normalizeGlobalAssetsRow } from '@/lib/global-assets';
import { normalizeAISettingsRow } from '@/lib/ai/settings';
import { normalizeContentTemplatesRow } from '@/lib/content-templates';
import { normalizeProjectTypeDefinitionsRow } from '@/lib/project-types';
import { requireProjectPermission } from '@/lib/permissions';
import { getOrganizationSettingsRow } from '@/lib/organization-settings';
import { normalizeSelectedAIReferenceKeys, resolveProjectTypeReferenceSelection, getProjectReferenceOptionKeys } from '@/lib/ai/reference-sources';

interface Params { params: { id: string } }

export async function POST(request: Request, { params }: Params) {
  let user;
  try {
    user = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();
    const body = await request.json() as { asset_types: AssetType[]; additional_instruction?: string };

    if (!body.asset_types?.length) {
      return NextResponse.json({ error: 'asset_types が必要です' }, { status: 400 });
    }

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
    const contentTemplates = normalizeContentTemplatesRow(globalAssetsRow);
    const currentProjectType = projectTypes.find((definition) => definition.key === project.type);

    const typedProject: ProjectWithFields = {
      ...project,
      custom_fields: fields.map(f => ({
        ...f,
        template_id: f.template_id || currentProjectType?.field_templates.find((fieldTemplate) => fieldTemplate.key === f.key)?.id,
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

    const results = [];

    for (const assetType of body.asset_types) {
      const contentTemplate = contentTemplates.find((template) =>
        currentProjectType?.content_template_ids.includes(template.id) && template.key === assetType
      );
      if (!contentTemplate) continue;

      const resolvedReferenceSettings = currentProjectType
        ? resolveProjectTypeReferenceSelection(currentProjectType, contentTemplate, typedGlobal.objects)
        : contentTemplate.ai_reference;
      const selectedSourceKeys = normalizeSelectedAIReferenceKeys(
        resolvedReferenceSettings,
        getProjectReferenceOptionKeys(typedProject, typedGlobal.objects),
      );
      const context = buildProjectContext(typedProject, typedGlobal, { selectedSourceKeys });

      const prompt = buildContentPrompt(contentTemplate, context, body.additional_instruction || '');
      const content = await generateText(prompt, SYSTEM_PROMPT, 4096, aiSettings);
      const warnings = extractWarnings(content);

      const assetId = uuidv4();
      const title = `${contentTemplate.name} — ${new Date().toLocaleDateString('ja-JP')}`;

      db.prepare(`
        INSERT INTO generated_assets (id, project_id, asset_type, title, content, warnings)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(assetId, params.id, assetType, title, content, JSON.stringify(warnings));

      results.push({ id: assetId, project_id: params.id, asset_type: assetType, title, content, warnings });
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Asset generation failed' }, { status: 500 });
  }
}
