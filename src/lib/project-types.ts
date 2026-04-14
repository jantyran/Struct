import type { ProjectFieldTemplate, ProjectPhase, ProjectTypeDefinition } from '@/types';

const DEFAULT_PROJECT_TYPES: ProjectTypeDefinition[] = [
  {
    id: 'project-type-event',
    key: 'event',
    name: 'イベント',
    description: 'イベント施策向けのプロジェクトです。',
    is_default: true,
    phases: [
      { id: 'event-phase-planning', key: 'planning', name: '企画' },
      { id: 'event-phase-preparation', key: 'preparation', name: '準備' },
      { id: 'event-phase-execution', key: 'execution', name: '実施' },
      { id: 'event-phase-followup', key: 'followup', name: '振り返り' },
    ],
    field_templates: [
      { id: 'event-field-theme', key: 'theme', label: 'イベントテーマ', type: 'text', options: '{}', layout: 'half' },
      { id: 'event-field-venue', key: 'venue', label: '会場', type: 'text', options: '{}', layout: 'half' },
    ],
    content_template_ids: ['content-template-sns-post', 'content-template-lp', 'content-template-email', 'content-template-report'],
  },
  {
    id: 'project-type-campaign',
    key: 'campaign',
    name: 'キャンペーン',
    description: '複数チャネル施策向けのプロジェクトです。',
    is_default: true,
    phases: [
      { id: 'campaign-phase-strategy', key: 'strategy', name: '戦略設計' },
      { id: 'campaign-phase-production', key: 'production', name: '制作' },
      { id: 'campaign-phase-launch', key: 'launch', name: '公開' },
      { id: 'campaign-phase-optimization', key: 'optimization', name: '改善' },
    ],
    field_templates: [
      { id: 'campaign-field-message', key: 'core_message', label: '訴求メッセージ', type: 'textarea', options: '{}', layout: 'full' },
      { id: 'campaign-field-kpi', key: 'kpi', label: '主要KPI', type: 'text', options: '{}', layout: 'half' },
    ],
    content_template_ids: ['content-template-sns-post', 'content-template-lp', 'content-template-email', 'content-template-ad-copy', 'content-template-report'],
  },
  {
    id: 'project-type-content',
    key: 'content',
    name: 'コンテンツ制作',
    description: '記事、資料、動画などの制作向けプロジェクトです。',
    is_default: true,
    phases: [
      { id: 'content-phase-brief', key: 'brief', name: '要件整理' },
      { id: 'content-phase-draft', key: 'draft', name: '初稿作成' },
      { id: 'content-phase-review', key: 'review', name: 'レビュー' },
      { id: 'content-phase-publish', key: 'publish', name: '公開' },
    ],
    field_templates: [
      { id: 'content-field-format', key: 'content_format', label: 'フォーマット', type: 'text', options: '{}', layout: 'half' },
      { id: 'content-field-source', key: 'source_reference', label: '参照元URL', type: 'url', options: '{}', layout: 'full' },
    ],
    content_template_ids: ['content-template-outline', 'content-template-first-draft'],
  },
];

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function safeJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizePhase(phase: Partial<ProjectPhase>, index: number): ProjectPhase {
  return {
    id: phase.id || `phase-${index + 1}`,
    key: (phase.key || `phase_${index + 1}`).trim() || `phase_${index + 1}`,
    name: phase.name?.trim() || `フェーズ ${index + 1}`,
  };
}

function normalizeFieldTemplate(field: Partial<ProjectFieldTemplate>, index: number): ProjectFieldTemplate {
  return {
    id: field.id || `field-template-${index + 1}`,
    key: (field.key || `field_${index + 1}`).trim() || `field_${index + 1}`,
    label: field.label?.trim() || `項目 ${index + 1}`,
    type: field.type || 'text',
    options: typeof field.options === 'string' && field.options ? field.options : '{}',
    layout: field.layout === 'full' ? 'full' : 'half',
  };
}

function normalizeTypeDefinition(definition: Partial<ProjectTypeDefinition>, index: number): ProjectTypeDefinition {
  const legacyContentTemplates = safeArray<{ id?: string }>((definition as any).content_templates);
  const contentTemplateIds = safeArray<string>(definition.content_template_ids).filter(Boolean);
  const fallbackContentTemplateIds =
    definition.key === 'event'
      ? ['content-template-sns-post', 'content-template-lp', 'content-template-email', 'content-template-report']
      : definition.key === 'campaign'
        ? ['content-template-sns-post', 'content-template-lp', 'content-template-email', 'content-template-ad-copy', 'content-template-report']
        : definition.key === 'content'
          ? ['content-template-outline', 'content-template-first-draft']
          : [];

  return {
    id: definition.id || `project-type-${index + 1}`,
    key: (definition.key || `project_type_${index + 1}`).trim() || `project_type_${index + 1}`,
    name: definition.name?.trim() || `プロジェクト種別 ${index + 1}`,
    description: definition.description ?? '',
    is_default: definition.is_default === true,
    phases: safeArray<Partial<ProjectPhase>>(definition.phases).map(normalizePhase),
    field_templates: safeArray<Partial<ProjectFieldTemplate>>(definition.field_templates).map(normalizeFieldTemplate),
    content_template_ids: contentTemplateIds.length > 0
      ? contentTemplateIds
      : legacyContentTemplates.length > 0
        ? legacyContentTemplates.map((template, contentIndex) => template.id || `content-template-${contentIndex + 1}`)
        : fallbackContentTemplateIds,
  };
}

export function defaultProjectTypeDefinitions(): ProjectTypeDefinition[] {
  return DEFAULT_PROJECT_TYPES.map((definition, index) => normalizeTypeDefinition(definition, index));
}

export function normalizeProjectTypeDefinitions(data: Partial<ProjectTypeDefinition>[] | null | undefined): ProjectTypeDefinition[] {
  const normalized = safeArray<Partial<ProjectTypeDefinition>>(data).map(normalizeTypeDefinition);
  return normalized.length > 0 ? normalized : defaultProjectTypeDefinitions();
}

export function normalizeProjectTypeDefinitionsRow(row: any): ProjectTypeDefinition[] {
  const parsed = safeJson<ProjectTypeDefinition[]>(row?.project_types, []);
  return normalizeProjectTypeDefinitions(parsed);
}

export function serializeProjectTypeDefinitions(definitions: ProjectTypeDefinition[]): string {
  return JSON.stringify(normalizeProjectTypeDefinitions(definitions));
}

export function createProjectTypeDefinition(seed: Partial<ProjectTypeDefinition> = {}): ProjectTypeDefinition {
  return normalizeTypeDefinition(
    {
      id: seed.id,
      key: seed.key,
      name: seed.name || '新しいプロジェクト種別',
      description: seed.description || '',
      is_default: seed.is_default,
      phases: seed.phases || [{ id: 'phase-planning', key: 'planning', name: '企画' }],
      field_templates: seed.field_templates || [],
      content_template_ids: seed.content_template_ids || [],
    },
    0
  );
}
