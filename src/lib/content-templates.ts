import type { ProjectContentTemplate } from '@/types';

export const CONTENT_CHANNEL_OPTIONS = [
  'X',
  'Instagram',
  'LinkedIn',
  'Facebook',
  'メール',
  'LP',
  'Web記事',
  '提案書',
  'レポート',
  '議事録',
  'ドキュメント',
  'その他',
] as const;

const DEFAULT_CONTENT_TEMPLATES: ProjectContentTemplate[] = [
  {
    id: 'content-template-sns-post',
    key: 'sns_post',
    name: 'SNS投稿',
    channel: 'X',
    channel_other: '',
    text_format: 'plain',
    tone: '簡潔で訴求力があり、スクロールを止めるトーン',
    mandatory_elements: '訴求ポイント、ベネフィット、行動喚起',
    example_structure: 'パターンA: 告知型\nパターンB: 問いかけ型\nパターンC: ベネフィット訴求型',
    instruction: 'SNS向けの投稿文を複数パターン生成してください。チャネル特性に合わせて、短く強いフックと行動喚起を含めてください。',
  },
  {
    id: 'content-template-lp',
    key: 'lp',
    name: 'LP',
    channel: 'LP',
    channel_other: '',
    text_format: 'markdown',
    tone: '明快、具体的、安心感のあるトーン',
    mandatory_elements: 'ファーストビュー、価値訴求、根拠、CTA',
    example_structure: 'ファーストビュー\n課題提起\nソリューション\nベネフィット\nFAQ\nCTA',
    instruction: 'ランディングページの構成案と主要コピーを作成してください。流入後に訴求内容と行動導線が明確に伝わる構成にしてください。',
  },
  {
    id: 'content-template-email',
    key: 'email',
    name: 'メール',
    channel: 'メール',
    channel_other: '',
    text_format: 'markdown',
    tone: '端的で分かりやすく、行動を促す',
    mandatory_elements: '件名、価値訴求、本文、CTA',
    example_structure: '件名\n導入\n価値訴求\n詳細\nCTA',
    instruction: 'メール本文を作成してください。件名からCTAまで一貫した流れで、読み手が次の行動を起こしやすい構成にしてください。',
  },
  {
    id: 'content-template-ad-copy',
    key: 'ad_copy',
    name: '広告コピー',
    channel: 'その他',
    channel_other: '広告',
    text_format: 'plain',
    tone: '短く強く、差別化ポイントが伝わるトーン',
    mandatory_elements: 'ヘッドライン、ボディコピー、CTA',
    example_structure: 'パターンA\nパターンB\nパターンC',
    instruction: '広告用のコピー案を複数パターン作成してください。ヘッドライン、本文、CTAをセットで出力してください。',
  },
  {
    id: 'content-template-report',
    key: 'report',
    name: 'レポート',
    channel: 'レポート',
    channel_other: '',
    text_format: 'markdown',
    tone: '客観的で整理されたビジネストーン',
    mandatory_elements: '概要、実施内容、示唆、次アクション',
    example_structure: 'サマリー\n概要\n実施内容\n示唆\n次アクション',
    instruction: '施策レポートまたは社内共有用の報告文書を作成してください。要点整理と示唆が分かる構成にしてください。',
  },
  {
    id: 'content-template-outline',
    key: 'content_outline',
    name: '構成案',
    channel: 'Web記事',
    channel_other: '',
    text_format: 'markdown',
    tone: '論理的で整理された表現',
    mandatory_elements: '導入、本論、結論、読者価値',
    example_structure: 'タイトル案\n見出し1\n見出し2\n見出し3\nまとめ',
    instruction: '制作物の構成案を作成してください。見出しと各セクションの要点を整理してください。',
  },
  {
    id: 'content-template-first-draft',
    key: 'content_first_draft',
    name: '初稿',
    channel: '提案書',
    channel_other: '',
    text_format: 'markdown',
    tone: 'プロジェクト目的に沿ったトーンで自然に',
    mandatory_elements: '核となる価値、根拠、読み手に必要な次アクション',
    example_structure: 'タイトル\n導入\n本論\n結論',
    instruction: '制作物の初稿を作成してください。トーンと目的に沿って本文を出力してください。',
  },

  // ── プロジェクト管理 ──────────────────────────────────
  {
    id: 'content-template-minutes',
    key: 'meeting_minutes',
    name: '議事録',
    channel: '議事録',
    channel_other: '',
    text_format: 'markdown',
    tone: '客観的・簡潔・事実ベース',
    mandatory_elements: '日時・参加者・議題・決定事項・アクションアイテム（担当・期日）',
    example_structure: '## 会議情報\n## 議題\n## 議論内容\n## 決定事項\n## アクションアイテム\n## 次回予定',
    instruction: '会議の内容をもとに議事録を作成してください。決定事項と担当・期日付きのアクションアイテムを明確に整理してください。',
  },
  {
    id: 'content-template-status-report',
    key: 'status_report',
    name: 'ステータスレポート',
    channel: 'レポート',
    channel_other: '',
    text_format: 'markdown',
    tone: '端的・客観的・ステークホルダー向け',
    mandatory_elements: '全体ステータス・進捗サマリー・課題／リスク・今週の完了事項・来週の予定',
    example_structure: '## 全体ステータス（🟢/🟡/🔴）\n## 進捗サマリー\n## 課題・リスク\n## 完了事項\n## 今後の予定',
    instruction: 'プロジェクトの定期ステータスレポートを作成してください。現在の状況を端的に伝え、課題とリスクを明確にしてください。',
  },
  {
    id: 'content-template-requirements',
    key: 'requirements_doc',
    name: '要件定義書',
    channel: 'ドキュメント',
    channel_other: '',
    text_format: 'markdown',
    tone: '論理的・明確・曖昧さのない表現',
    mandatory_elements: '背景・目的・スコープ・機能要件・非機能要件・制約条件・用語定義',
    example_structure: '## 背景・目的\n## スコープ\n## 機能要件\n## 非機能要件\n## 制約条件\n## 用語定義',
    instruction: 'プロジェクトの要件定義書を作成してください。機能要件と非機能要件を整理し、スコープと制約条件を明確に記述してください。',
  },
  {
    id: 'content-template-risk-register',
    key: 'risk_register',
    name: 'リスク整理',
    channel: 'ドキュメント',
    channel_other: '',
    text_format: 'markdown',
    tone: '分析的・具体的・対策志向',
    mandatory_elements: 'リスク内容・影響度・発生確率・対応方針・担当者',
    example_structure: '## リスク一覧\n| リスク | 影響度 | 確率 | 対応方針 | 担当 |\n## 対応優先度まとめ',
    instruction: 'プロジェクトのリスクを洗い出し、影響度と発生確率で整理してください。各リスクに対応方針と担当者を設定してください。',
  },
  {
    id: 'content-template-retrospective',
    key: 'retrospective',
    name: '振り返りレポート',
    channel: 'レポート',
    channel_other: '',
    text_format: 'markdown',
    tone: '建設的・率直・改善志向',
    mandatory_elements: 'よかったこと・改善点・学び・次回への改善アクション',
    example_structure: '## 概要\n## よかったこと（Keep）\n## 改善点（Problem）\n## 学び\n## 次回アクション（Try）',
    instruction: 'プロジェクトまたはスプリントの振り返りレポートを作成してください。KPT形式を基本とし、次回アクションを具体的に設定してください。',
  },
  {
    id: 'content-template-task-description',
    key: 'task_description',
    name: 'タスク説明',
    channel: 'ドキュメント',
    channel_other: '',
    text_format: 'markdown',
    tone: '簡潔・具体的・実行可能',
    mandatory_elements: '背景・目的・作業内容・完了条件・参考情報',
    example_structure: '## 背景・目的\n## 作業内容\n## 完了条件\n## 参考・注意事項',
    instruction: 'タスクまたはチケットの説明文を作成してください。担当者が迷わず着手できるよう、目的・作業内容・完了条件を明確に記述してください。',
  },
  {
    id: 'content-template-project-overview',
    key: 'project_overview',
    name: 'プロジェクト概要',
    channel: 'ドキュメント',
    channel_other: '',
    text_format: 'markdown',
    tone: '明快・説得力があり関係者に伝わる表現',
    mandatory_elements: '背景・目的・スコープ・体制・スケジュール・成功指標',
    example_structure: '## 背景・課題\n## プロジェクト目的\n## スコープ\n## 体制\n## スケジュール概要\n## 成功指標（KPI）',
    instruction: 'プロジェクトの概要ドキュメントを作成してください。関係者が全体像を把握できるよう、背景から成功指標まで整理してください。',
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

function normalizeContentTemplate(template: Partial<ProjectContentTemplate>, index: number): ProjectContentTemplate {
  return {
    id: template.id || `content-template-${index + 1}`,
    key: (template.key || `content_${index + 1}`).trim() || `content_${index + 1}`,
    name: template.name?.trim() || `生成コンテンツ ${index + 1}`,
    channel: CONTENT_CHANNEL_OPTIONS.includes((template.channel || '') as typeof CONTENT_CHANNEL_OPTIONS[number]) ? template.channel!.trim() : 'その他',
    channel_other: template.channel_other?.trim() || '',
    text_format: template.text_format === 'plain' ? 'plain' : 'markdown',
    tone: template.tone?.trim() || '',
    mandatory_elements: template.mandatory_elements?.trim() || '',
    example_structure: template.example_structure?.trim() || '',
    instruction: template.instruction?.trim() || 'このプロジェクト向けのコンテンツを生成してください。',
  };
}

export function defaultContentTemplates(): ProjectContentTemplate[] {
  return DEFAULT_CONTENT_TEMPLATES.map((template, index) => normalizeContentTemplate(template, index));
}

export function normalizeContentTemplates(data: Partial<ProjectContentTemplate>[] | null | undefined): ProjectContentTemplate[] {
  const normalized = safeArray<Partial<ProjectContentTemplate>>(data).map(normalizeContentTemplate);
  return normalized.length > 0 ? normalized : defaultContentTemplates();
}

export function normalizeContentTemplatesRow(row: any): ProjectContentTemplate[] {
  const parsed = safeJson<ProjectContentTemplate[]>(row?.content_templates, []);
  return normalizeContentTemplates(parsed);
}

export function serializeContentTemplates(templates: ProjectContentTemplate[]): string {
  return JSON.stringify(normalizeContentTemplates(templates));
}

export function createContentTemplate(seed: Partial<ProjectContentTemplate> = {}): ProjectContentTemplate {
  return normalizeContentTemplate(
    {
      id: seed.id,
      key: seed.key,
      name: seed.name || '新しい生成コンテンツ',
      channel: seed.channel || 'その他',
      channel_other: seed.channel_other || '',
      text_format: seed.text_format || 'markdown',
      tone: seed.tone || '',
      mandatory_elements: seed.mandatory_elements || '',
      example_structure: seed.example_structure || '',
      instruction: seed.instruction || 'このプロジェクト向けのコンテンツを生成してください。',
    },
    0
  );
}
