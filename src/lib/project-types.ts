import type { ProjectFieldTemplate, ProjectPhase, ProjectTypeDefinition, SectionDefinition, SectionFieldPlacement } from '@/types';
import { WIDGET_FIELD_ID_PREFIX } from '@/types';
import { normalizeAIReferenceSettings } from '@/lib/ai/reference-sources';

/** デフォルトセクション定義 */
export const DEFAULT_SECTIONS: SectionDefinition[] = [
  { id: 'section-basic', name: '基本情報', color: '#0f9ab1', items: [] },
  { id: 'section-detail', name: '詳細', color: '#6366f1', items: [] },
];

const SECTION_COLOR_PRESETS = [
  '#0f9ab1',
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
];

/**
 * 組み込みフィールドテンプレートのデフォルト定義（全プロジェクト種別共通）
 *
 * 設計方針：
 * - マーケティング施策に普遍的に必要なフィールドのみを組み込みとする
 * - 種別固有の情報はカスタムテンプレート (DEFAULT_CUSTOM_TEMPLATES) で管理する
 */
export const BUILTIN_FIELD_TEMPLATES: ProjectFieldTemplate[] = [
  {
    id: '_builtin_description',
    key: 'description',
    label: '目的・背景',
    type: 'textarea',
    options: '{}',
    layout: 'full',
    is_builtin: true,
    section: '基本情報',
  },
  {
    id: '_builtin_target',
    key: 'target',
    label: 'ターゲット',
    type: 'textarea',
    options: '{}',
    layout: 'full',
    is_builtin: true,
    section: '基本情報',
  },
  {
    id: '_builtin_kpi',
    key: 'kpi',
    label: '目標KPI・成果指標',
    type: 'textarea',
    options: '{}',
    layout: 'full',
    is_builtin: true,
    section: '基本情報',
  },
  {
    id: '_builtin_start_date',
    key: 'start_date',
    label: '開始日',
    type: 'date',
    options: '{}',
    layout: 'half',
    is_builtin: true,
    section: '基本情報',
  },
  {
    id: '_builtin_end_date',
    key: 'end_date',
    label: '終了日',
    type: 'date',
    options: '{}',
    layout: 'half',
    is_builtin: true,
    section: '基本情報',
  },
  {
    id: '_builtin_budget',
    key: 'budget',
    label: '予算（円）',
    type: 'number',
    options: '{}',
    layout: 'half',
    is_builtin: true,
    section: '基本情報',
  },
  {
    id: '_builtin_channels',
    key: 'channels',
    label: '主要チャネル',
    type: 'textarea',
    options: '{}',
    layout: 'half',
    is_builtin: true,
    section: '基本情報',
  },
  {
    id: '_builtin_related_links',
    key: 'related_links',
    label: '関連リンク',
    type: 'list',
    options: JSON.stringify({
      children: [
        {
          id: '_builtin_related_links_item',
          key: 'related_link',
          label: 'リンク',
          type: 'url',
          options: '{}',
          layout: 'full',
          is_builtin: true,
          section: '基本情報',
        },
      ],
    }),
    layout: 'full',
    is_builtin: true,
    section: '基本情報',
  },
];

const DEFAULT_PROJECT_TYPES: Omit<ProjectTypeDefinition, 'field_templates' | 'sections'>[] = [
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
    content_template_ids: ['content-template-outline', 'content-template-first-draft'],
  },
];

// カスタムフィールドテンプレートのデフォルト（組み込み以外・種別固有）
const DEFAULT_CUSTOM_TEMPLATES: Record<string, ProjectFieldTemplate[]> = {
  event: [
    {
      id: 'event-field-format',
      key: 'event_format',
      label: '開催形式',
      type: 'select',
      options: JSON.stringify({ choices: ['オンライン', 'オフライン', 'ハイブリッド'] }),
      layout: 'half',
      section: '詳細',
    },
    {
      id: 'event-field-venue',
      key: 'venue',
      label: '会場・プラットフォーム',
      type: 'text',
      options: '{}',
      layout: 'half',
      section: '詳細',
    },
    {
      id: 'event-field-capacity',
      key: 'capacity',
      label: '定員・想定参加者数',
      type: 'number',
      options: '{}',
      layout: 'half',
      section: '詳細',
    },
    {
      id: 'event-field-theme',
      key: 'theme',
      label: 'テーマ・タグライン',
      type: 'text',
      options: '{}',
      layout: 'half',
      section: '詳細',
    },
    {
      id: 'event-field-registration-url',
      key: 'registration_url',
      label: '申し込みページURL',
      type: 'url',
      options: '{}',
      layout: 'full',
      section: '詳細',
    },
  ],
  campaign: [
    {
      id: 'campaign-field-type',
      key: 'campaign_type',
      label: 'キャンペーン種別',
      type: 'select',
      options: JSON.stringify({ choices: ['認知拡大', 'リード獲得', 'ナーチャリング（育成）', '購入・申し込み促進', 'ロイヤリティ向上', 'その他'] }),
      layout: 'half',
      section: '詳細',
    },
    {
      id: 'campaign-field-message',
      key: 'core_message',
      label: '訴求メッセージ・コア提案',
      type: 'textarea',
      options: '{}',
      layout: 'full',
      section: '詳細',
    },
    {
      id: 'campaign-field-lp-url',
      key: 'landing_page_url',
      label: 'LP / ランディングページURL',
      type: 'url',
      options: '{}',
      layout: 'half',
      section: '詳細',
    },
    {
      id: 'campaign-field-cta',
      key: 'cta',
      label: 'CTA（行動喚起フレーズ）',
      type: 'text',
      options: '{}',
      layout: 'half',
      section: '詳細',
    },
  ],
  content: [
    {
      id: 'content-field-format',
      key: 'content_format',
      label: 'コンテンツ種別・フォーマット',
      type: 'select',
      options: JSON.stringify({ choices: ['ブログ記事', 'ホワイトペーパー', '動画', 'インフォグラフィック', 'ケーススタディ', 'ニュースリリース', 'SNS投稿', 'その他'] }),
      layout: 'half',
      section: '詳細',
    },
    {
      id: 'content-field-medium',
      key: 'publication_medium',
      label: '掲載先・配信先',
      type: 'text',
      options: '{}',
      layout: 'half',
      section: '詳細',
    },
    {
      id: 'content-field-length',
      key: 'target_length',
      label: '目標文字数・尺',
      type: 'text',
      options: '{}',
      layout: 'half',
      section: '詳細',
    },
    {
      id: 'content-field-source',
      key: 'source_reference',
      label: '参考・参照元URL',
      type: 'url',
      options: '{}',
      layout: 'full',
      section: '詳細',
    },
  ],
};

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

function normalizeLayout(value: unknown): 'half' | 'full' {
  return value === 'full' ? 'full' : 'half';
}

function normalizeSectionFieldPlacement(item: Partial<SectionFieldPlacement>, index: number): SectionFieldPlacement {
  const kind = item.kind ?? 'field';
  return {
    id: item.id || `section-item-${index + 1}`,
    field_id: typeof item.field_id === 'string' ? item.field_id : '',
    layout: normalizeLayout(item.layout),
    kind,
  };
}

function normalizeSection(section: Partial<SectionDefinition>, index: number): SectionDefinition {
  return {
    id: section.id || `section-${index + 1}`,
    name: section.name?.trim() || `セクション ${index + 1}`,
    color: typeof section.color === 'string' && section.color ? section.color : DEFAULT_SECTIONS[index % DEFAULT_SECTIONS.length]?.color ?? '#0f9ab1',
    items: safeArray<Partial<SectionFieldPlacement>>((section as SectionDefinition).items).map(normalizeSectionFieldPlacement),
    ...(section.defaultOpen !== undefined ? { defaultOpen: section.defaultOpen } : {}),
  };
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
    layout: normalizeLayout(field.layout),
    is_builtin: field.is_builtin === true,
    section: typeof field.section === 'string' ? field.section : (field.is_builtin ? '基本情報' : ''),
  };
}

function appendMissingSections(sections: SectionDefinition[], names: string[]): SectionDefinition[] {
  const existingNames = new Set(sections.map((section) => section.name));
  const nextSections = [...sections];

  names.forEach((name) => {
    if (!name || existingNames.has(name)) return;
    const color = SECTION_COLOR_PRESETS[nextSections.length % SECTION_COLOR_PRESETS.length] ?? '#0f9ab1';
    nextSections.push({
      id: `section-${nextSections.length + 1}`,
      name,
      color,
      items: [],
    });
    existingNames.add(name);
  });

  return nextSections;
}

function buildSectionItemsFromLegacyFields(fields: ProjectFieldTemplate[], sections: SectionDefinition[]): SectionDefinition[] {
  return sections.map((section) => ({
    ...section,
    items: fields
      .filter((field) => (field.section ?? '') === section.name)
      .map((field, index) => ({
        id: `${section.id}-item-${index + 1}`,
        field_id: field.id,
        layout: normalizeLayout(field.layout),
      })),
  }));
}

function sanitizeSectionItems(sections: SectionDefinition[], fields: ProjectFieldTemplate[]): SectionDefinition[] {
  const knownFieldIds = new Set(fields.map((field) => field.id));
  // フィールドはグローバルで重複排除（同一フィールドを複数セクションに配置不可）
  const seenFieldIds = new Set<string>();

  return sections.map((section) => {
    // 情報ウィジェットはセクション内での重複のみ排除（複数セクションには配置可能）
    const seenWidgetsInSection = new Set<string>();

    return {
      ...section,
      items: section.items.filter((item) => {
        const kind = item.kind ?? 'field';

        if (kind !== 'field') {
          // 情報ウィジェット: 同一セクション内での重複のみ弾く
          const key = `${WIDGET_FIELD_ID_PREFIX}${kind}`;
          if (seenWidgetsInSection.has(key)) return false;
          seenWidgetsInSection.add(key);
          return true;
        }

        // 通常フィールド: 全セクションで重複排除
        if (!item.field_id || !knownFieldIds.has(item.field_id) || seenFieldIds.has(item.field_id)) return false;
        seenFieldIds.add(item.field_id);
        return true;
      }),
    };
  });
}

/**
 * stored field_templates から組み込みフィールドのカスタマイズを抽出し、
 * デフォルト定義にマージして返す。
 * stored に組み込みフィールドが存在しなければデフォルトを使う。
 */
function mergeBuiltinTemplates(storedTemplates: Partial<ProjectFieldTemplate>[]): ProjectFieldTemplate[] {
  const storedBuiltins = storedTemplates.filter((t) => t.is_builtin === true || String(t.id ?? '').startsWith('_builtin_'));

  return BUILTIN_FIELD_TEMPLATES.map((def) => {
    const stored = storedBuiltins.find((t) => t.id === def.id || t.key === def.key);
    if (!stored) return def;
    return {
      ...def,
      label: stored.label?.trim() || def.label,
      layout: normalizeLayout(stored.layout ?? def.layout),
      section: typeof stored.section === 'string' ? stored.section : def.section,
    };
  });
}

function normalizeTypeDefinition(
  definition: Partial<ProjectTypeDefinition> & { field_templates?: Partial<ProjectFieldTemplate>[]; sections?: Partial<SectionDefinition>[] },
  index: number
): ProjectTypeDefinition {
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

  const storedTemplates = safeArray<Partial<ProjectFieldTemplate>>(definition.field_templates);
  // 組み込みフィールド（カスタマイズ反映済み）
  const builtins = mergeBuiltinTemplates(storedTemplates);
  // カスタムフィールド（is_builtin でないもの）
  const customs = storedTemplates
    .filter((t) => !t.is_builtin && !String(t.id ?? '').startsWith('_builtin_'))
    .map(normalizeFieldTemplate);

  // 初回（storedが空）かつデフォルト種別の場合、カスタム初期値を補完
  const defaultCustoms = customs.length === 0 ? (DEFAULT_CUSTOM_TEMPLATES[definition.key ?? ''] ?? []) : customs;
  const normalizedFieldTemplates = [...builtins, ...defaultCustoms];

  // セクション定義を正規化（保存済みがあればそれを使用、なければデフォルト）
  const storedSections = safeArray<Partial<SectionDefinition>>(definition.sections);
  const sectionNamesFromLegacyFields = Array.from(new Set(
    normalizedFieldTemplates
      .map((field) => field.section?.trim() || '')
      .filter(Boolean)
  ));
  const baseSections = storedSections.length > 0
    ? storedSections.map(normalizeSection)
    : [...DEFAULT_SECTIONS];
  const normalizedSections = appendMissingSections(baseSections, sectionNamesFromLegacyFields);
  const hasExplicitSectionItems = storedSections.some((section) => Object.prototype.hasOwnProperty.call(section, 'items'));
  const sectionsWithItems = hasExplicitSectionItems
    ? sanitizeSectionItems(normalizedSections, normalizedFieldTemplates)
    : buildSectionItemsFromLegacyFields(normalizedFieldTemplates, normalizedSections);

  return {
    id: definition.id || `project-type-${index + 1}`,
    key: (definition.key || `project_type_${index + 1}`).trim() || `project_type_${index + 1}`,
    name: definition.name?.trim() || `プロジェクト種別 ${index + 1}`,
    description: definition.description ?? '',
    is_default: definition.is_default === true,
    phases: safeArray<Partial<ProjectPhase>>(definition.phases).map(normalizePhase),
    sections: sectionsWithItems,
    field_templates: normalizedFieldTemplates,
    content_template_ids: contentTemplateIds.length > 0
      ? contentTemplateIds
      : legacyContentTemplates.length > 0
        ? legacyContentTemplates.map((template, i) => template.id || `content-template-${i + 1}`)
        : fallbackContentTemplateIds,
    ai_reference: definition.ai_reference
      ? normalizeAIReferenceSettings(definition.ai_reference)
      : undefined,
  };
}

export function defaultProjectTypeDefinitions(): ProjectTypeDefinition[] {
  return DEFAULT_PROJECT_TYPES.map((definition, index) =>
    normalizeTypeDefinition({ ...definition, field_templates: [] }, index)
  );
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
      sections: seed.sections || [],
      field_templates: seed.field_templates || [],
      content_template_ids: seed.content_template_ids || [],
      ai_reference: seed.ai_reference,
    },
    0
  );
}
