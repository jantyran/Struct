export type ProjectType = 'event' | 'campaign' | 'content' | 'other';
export type ProjectStatus = 'draft' | 'active' | 'archived';
export type FieldType = 'text' | 'textarea' | 'url' | 'date' | 'select';
export type AssetType = 'lp' | 'dm' | 'sns_twitter' | 'sns_linkedin' | 'ad_copy' | 'email' | 'report';

export interface Product {
  id: string;
  name: string;
  description: string;
  features: string;
  price: string;
}

export interface GlobalAssets {
  company_name: string;
  company_description: string;
  brand_voice: string;
  brand_guidelines: string;
  products: Product[];
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
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
}

export interface CustomField {
  id: string;
  project_id: string;
  key: string;
  label: string;
  type: FieldType;
  value: string;
  options: string; // JSON string for select type
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

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
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
};
