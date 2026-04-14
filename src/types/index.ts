export type ProjectType = string;
export type ProjectStatus = 'draft' | 'active' | 'archived';
export type FieldType = 'text' | 'textarea' | 'url' | 'date' | 'select' | 'reference' | 'reference_multi' | 'group' | 'group_list';
export type FieldLayout = 'half' | 'full';
export type AssetType = string;
export type GlobalAssetFieldType = 'text' | 'textarea' | 'url' | 'number' | 'date' | 'reference' | 'reference_multi';
export type AIProvider = 'anthropic' | 'openai' | 'gemini';

export interface AISettings {
  provider: AIProvider;
  model: string;
  api_key: string;
  base_url: string;
}

export interface ProjectPhase {
  id: string;
  key: string;
  name: string;
}

export interface ProjectFieldTemplate {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  options: string;
  layout?: FieldLayout;
}

export interface ProjectContentTemplate {
  id: string;
  key: string;
  name: string;
  channel: string;
  channel_other: string;
  text_format: 'plain' | 'markdown';
  tone: string;
  mandatory_elements: string;
  example_structure: string;
  instruction: string;
}

export interface ProjectTypeDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  phases: ProjectPhase[];
  field_templates: ProjectFieldTemplate[];
  content_template_ids: string[];
  is_default?: boolean;
}

export interface GlobalAssetField {
  id: string;
  key: string;
  label: string;
  type: GlobalAssetFieldType;
  options?: string;
}

export interface GlobalAssetRecord {
  id: string;
  name: string;
  key: string;
  values: Record<string, string>;
}

export interface GlobalAssetObject {
  id: string;
  key: string;
  name: string;
  description: string;
  fields: GlobalAssetField[];
  records: GlobalAssetRecord[];
  is_default?: boolean;
}

export interface GlobalAssets {
  objects: GlobalAssetObject[];
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  phase_key: string;
  status: ProjectStatus;
  cloned_from: string | null;
  target: string;
  start_date: string;
  end_date: string;
  budget: string;
  channels: string; // JSON string
  description: string;
  created_at: string;
  updated_at: string;
  ownerId: string;
  members?: Array<{ user: { email: string, name: string | null }, role: string }>;
  invitations?: Array<{ email: string, role: string, status: string }>;
}

export interface CustomField {
  id: string;
  project_id: string;
  template_id?: string;
  key: string;
  label: string;
  type: FieldType;
  value: string;
  options: string; // JSON string for select / reference config
  layout?: FieldLayout;
  inherited: number; // 0 or 1
  inherited_from: string | null;
  crawled_content: string | null;
  sort_order: number;
}

export interface ProjectWithFields extends Project {
  custom_fields: CustomField[];
}

export interface GeneratedAsset {
  id: string;
  project_id: string;
  asset_type: AssetType;
  title: string;
  content: string;
  warnings: string; // JSON string
  created_at: string;
}

export interface CloneOptions {
  new_name: string;
  include_values: boolean; // false = フィールド定義のみ, true = 定義+値
}

export interface GenerateRequest {
  asset_types: AssetType[];
}

export interface CompletionSuggestion {
  field_id: string;
  label: string;
  suggested_value: string;
  reason: string;
}

export const ASSET_TYPE_LABELS: Record<string, string> = {
  lp: 'LP構成案',
  dm: 'ダイレクトメール',
  sns_twitter: 'Twitter/X投稿',
  sns_linkedin: 'LinkedIn投稿',
  ad_copy: '広告コピー',
  email: 'メールマガジン',
  report: '社内報告書',
};

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  event: 'イベント',
  campaign: 'キャンペーン',
  content: 'コンテンツ制作',
  other: 'その他',
};

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'テキスト',
  textarea: '長文テキスト',
  url: 'URL',
  date: '日付',
  select: '選択肢',
  reference: '参照',
  reference_multi: '複数参照',
  group: 'グループ',
  group_list: '繰り返しグループ',
};
