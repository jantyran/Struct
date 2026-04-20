import type {
  AIReferenceSettings,
  CustomField,
  GlobalAssetObject,
  ProjectFieldTemplate,
  ProjectTypeDefinition,
  ProjectWithFields,
} from '@/types';

export type AIReferenceOption = {
  key: string;
  label: string;
  description: string;
  group: 'base' | 'global_assets' | 'fields';
};

const BASE_REFERENCE_OPTIONS: AIReferenceOption[] = [
  {
    key: 'project-core',
    label: 'プロジェクト基本情報',
    description: '名称、種別、フェーズ、ステータスなどの基本情報',
    group: 'base',
  },
  {
    key: 'project-notes',
    label: 'プロジェクトノート',
    description: 'プロジェクト内のノート本文',
    group: 'base',
  },
  {
    key: 'generated-assets',
    label: '生成済みコンテンツ',
    description: '同じプロジェクトで既に生成したコンテンツ',
    group: 'base',
  },
  {
    key: 'reference-records',
    label: '参照項目の関連オブジェクト',
    description: 'reference / reference_multi で選ばれたレコード詳細',
    group: 'base',
  },
  {
    key: 'url-crawled-content',
    label: 'URL取得内容',
    description: 'URL項目に保存された取得済み本文',
    group: 'base',
  },
];

export function createEmptyAIReferenceSettings(): AIReferenceSettings {
  return {
    selected_source_keys: [],
    known_source_keys: [],
  };
}

export function normalizeAIReferenceSettings(input: unknown): AIReferenceSettings {
  const source = typeof input === 'object' && input !== null ? input as Partial<AIReferenceSettings> : {};
  return {
    selected_source_keys: Array.isArray(source.selected_source_keys)
      ? source.selected_source_keys.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : [],
    known_source_keys: Array.isArray(source.known_source_keys)
      ? source.known_source_keys.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : [],
  };
}

export function globalObjectReferenceKey(objectId: string) {
  return `global-object:${objectId}`;
}

export function fieldReferenceKey(fieldId: string) {
  return `field:${fieldId}`;
}

export function customFieldReferenceKey(field: Pick<CustomField, 'template_id' | 'id'>) {
  return fieldReferenceKey(field.template_id || field.id);
}

export function getCommonAIReferenceOptions(globalObjects: GlobalAssetObject[]): AIReferenceOption[] {
  return [
    ...BASE_REFERENCE_OPTIONS,
    ...globalObjects.map((object) => ({
      key: globalObjectReferenceKey(object.id),
      label: object.name,
      description: object.description || 'Global Assets のオブジェクト',
      group: 'global_assets' as const,
    })),
  ];
}

export function getProjectTypeAIReferenceOptions(definition: ProjectTypeDefinition, globalObjects: GlobalAssetObject[]): AIReferenceOption[] {
  return [
    ...getCommonAIReferenceOptions(globalObjects),
    ...definition.field_templates.map((field) => ({
      key: fieldReferenceKey(field.id),
      label: field.label,
      description: field.type === 'url'
        ? 'URL項目。URL取得内容も設定次第で参照'
        : field.type === 'reference' || field.type === 'reference_multi'
          ? '参照項目。関連レコードも設定次第で参照'
          : `項目タイプ: ${field.type}`,
      group: 'fields' as const,
    })),
  ];
}

export function normalizeSelectedAIReferenceKeys(settings: AIReferenceSettings | undefined, availableKeys: string[]): string[] {
  if (availableKeys.length === 0) return [];

  const normalized = normalizeAIReferenceSettings(settings);
  if (normalized.selected_source_keys.length === 0 && normalized.known_source_keys.length === 0) {
    return [...availableKeys];
  }

  const selected = new Set(normalized.selected_source_keys.filter((key) => availableKeys.includes(key)));
  const known = new Set(normalized.known_source_keys);
  for (const key of availableKeys) {
    if (!known.has(key)) {
      selected.add(key);
    }
  }
  return availableKeys.filter((key) => selected.has(key));
}

export function createStoredAIReferenceSettings(selectedKeys: string[], availableKeys: string[]): AIReferenceSettings {
  const availableSet = new Set(availableKeys);
  const uniqueSelected = Array.from(new Set(selectedKeys)).filter((key) => availableSet.has(key));
  return {
    selected_source_keys: uniqueSelected,
    known_source_keys: [...availableKeys],
  };
}


export function isReferenceSourceSelected(selectedKeys: Set<string>, key: string) {
  return selectedKeys.has(key);
}

export function getProjectReferenceOptionKeys(project: ProjectWithFields, globalObjects: GlobalAssetObject[]) {
  return [
    ...BASE_REFERENCE_OPTIONS.map((option) => option.key),
    ...globalObjects.map((object) => globalObjectReferenceKey(object.id)),
    ...project.custom_fields.map((field) => customFieldReferenceKey(field)),
  ];
}
