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
