export type ProjectType = string;
export type ProjectStatus = 'draft' | 'active' | 'archived';
export type FieldType = 'text' | 'textarea' | 'url' | 'date' | 'number' | 'select' | 'reference' | 'reference_multi' | 'group' | 'group_list';
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

export interface AIReferenceSettings {
  selected_source_keys: string[];
  known_source_keys: string[];
}

export interface ProjectPhase {
  id: string;
  key: string;
  name: string;
}

/** セクションに配置できるアイテムの種別 */
export type SectionItemKind = 'field' | 'project_type' | 'phase' | 'note_list';

/** 情報ウィジェットの仮想 field_id プレフィックス */
export const WIDGET_FIELD_ID_PREFIX = '__widget:';

/** 情報ウィジェット定義（セクションに配置できる非フィールドアイテム） */
export const SECTION_INFO_WIDGETS: { kind: SectionItemKind; label: string; description: string }[] = [
  { kind: 'project_type', label: 'プロジェクト種別', description: '種別名・キーを表示' },
  { kind: 'phase', label: '進行フェーズ', description: '現在のフェーズをパス形式で表示' },
  { kind: 'note_list', label: 'ノート一覧', description: 'プロジェクトのノートをインライン表示' },
];

export interface ProjectNote {
  id: string;
  project_id: string;
  title: string;
  body: string;
  pinned: number; // 0 | 1
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SectionFieldPlacement {
  id: string;
  /** kind='field' のときはフィールドテンプレートID。情報ウィジェットは '__widget:<kind>' 形式の仮想ID */
  field_id: string;
  layout: FieldLayout;
  /** 省略時は 'field' 扱い */
  kind?: SectionItemKind;
}

export interface SectionDefinition {
  id: string;
  name: string;
  /** hex color, e.g. '#0f9ab1' */
  color: string;
  /** セクション内の表示順・列幅 */
  items: SectionFieldPlacement[];
}

export interface ProjectFieldTemplate {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  options: string;
  /** @deprecated UI配置は sections.items で管理する */
  layout?: FieldLayout;
  /** true = 組み込みフィールド（元コアフィールド）。UIで削除不可 */
  is_builtin?: boolean;
  /** @deprecated UI配置は sections.items で管理する */
  section?: string;
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
  /** セクション定義（表示順・カラー） */
  sections: SectionDefinition[];
  /** 組み込み + カスタムフィールドテンプレートを統合管理 */
  field_templates: ProjectFieldTemplate[];
  content_template_ids: string[];
  ai_reference?: AIReferenceSettings;
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
  organization_id?: string;
  name: string;
  type: ProjectType;
  phase_key: string;
  status: ProjectStatus;
  cloned_from: string | null;
  primary_assignee_id?: string | null;
  primary_assignee?: ProjectUser | null;
  /** @deprecated コアフィールドは custom_fields に移行済み。後方互換のため残存 */
  target?: string;
  start_date?: string;
  end_date?: string;
  budget?: string;
  channels?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  ownerId: string;
  owner?: ProjectUser;
  members?: ProjectMember[];
  invitations?: Array<{ email: string, role: string, status: string }>;
  assignable_users?: ProjectUser[];
  registered_users?: ProjectUser[];
  project_role_definitions?: ProjectRoleDefinition[];
  current_permissions?: ProjectAccessPermissions;
}

export interface ProjectUser {
  id: string;
  organization_id?: string | null;
  email: string;
  name: string | null;
  avatar_url?: string | null;
}

export interface ProjectMember {
  id: string;
  user: ProjectUser;
  role: string;
}

export type SystemPermissionKey =
  | 'manage_organization_settings'
  | 'manage_users'
  | 'manage_system_roles'
  | 'manage_project_roles'
  | 'manage_project_settings'
  | 'manage_master_data'
  | 'manage_ai_settings'
  | 'view_all_projects'
  | 'edit_all_projects'
  | 'delete_any_project';

export type SystemPermissions = Record<SystemPermissionKey, boolean>;

export interface ProjectAccessPermissions {
  is_owner: boolean;
  project_role: string | null;
  system_permissions: SystemPermissions;
  can_view: boolean;
  can_edit: boolean;
  can_manage_members: boolean;
  can_delete: boolean;
  can_view_items: boolean;
  can_edit_items: boolean;
  can_view_content: boolean;
  can_generate_content: boolean;
  can_view_notes: boolean;
  can_edit_notes: boolean;
}

export interface RoleDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  permissions: SystemPermissions;
  is_system: boolean;
  sort_order: number;
}

export type ProjectRolePermissionKey =
  | 'can_view'
  | 'can_edit'
  | 'can_manage_members'
  | 'can_delete'
  | 'can_view_items'
  | 'can_edit_items'
  | 'can_view_content'
  | 'can_generate_content'
  | 'can_view_notes'
  | 'can_edit_notes';

export type ProjectRolePermissions = Record<ProjectRolePermissionKey, boolean>;

export interface ProjectRoleDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  permissions: ProjectRolePermissions;
  is_system: boolean;
  sort_order: number;
}

export interface CustomField {
  id: string;
  project_id: string;
  template_id?: string;
  key: string;
  label: string;
  type: FieldType;
  value: string;
  options: string;
  layout?: FieldLayout;
  inherited: number; // 0 or 1
  inherited_from: string | null;
  crawled_content: string | null;
  sort_order: number;
  /** 1 = 組み込みフィールド（元コアフィールド） */
  is_builtin: number;
  /** セクション名 */
  section: string;
}

export interface ProjectWithFields extends Project {
  custom_fields: CustomField[];
  project_notes?: ProjectNote[];
  generated_assets?: GeneratedAsset[];
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

export type TodoStatus = 'todo' | 'in_progress' | 'done';
export type TodoPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Todo {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  description: string;
  status: TodoStatus;
  priority: TodoPriority;
  assignee_id: string | null;
  assignee?: { id: string; name: string | null; email: string } | null;
  phase_key: string;
  start_date: string;
  due_date: string;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  subtasks?: Todo[];
}

export const TODO_STATUS_LABELS: Record<TodoStatus, string> = {
  todo: '未着手',
  in_progress: '進行中',
  done: '完了',
};

export const TODO_PRIORITY_LABELS: Record<TodoPriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '緊急',
};

export const TODO_PRIORITY_COLORS: Record<TodoPriority, string> = {
  low: '#6b7280',
  medium: '#3b82f6',
  high: '#f59e0b',
  urgent: '#ef4444',
};

export interface CloneOptions {
  new_name: string;
  include_values: boolean;
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
  number: '数値',
  select: '選択肢',
  reference: '参照',
  reference_multi: '複数参照',
  group: 'グループ',
  group_list: '繰り返しグループ',
};
