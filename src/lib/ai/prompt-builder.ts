import type { GlobalAssets, ProjectWithFields, CustomField, CompletionSuggestion, ProjectContentTemplate } from '@/types';

const SYSTEM_PROMPT = `あなたはプロフェッショナルなマーケティングストラテジストです。
提供されたプロジェクトデータとブランド情報のみを根拠として、高品質なマーケティングコンテンツを生成します。

厳守すべき制約：
1. 提供されたデータに記載のない日付・数字・スペック・実績を推測・捏造しないこと
2. [継承・要確認] フラグのついたフィールドを使用する場合、出力の末尾に警告を記載すること
3. ブランドボイスとガイドラインに厳密に従うこと
4. 日本語で出力すること（指定がない限り）`;

export function buildProjectContext(project: ProjectWithFields, globalAssets: GlobalAssets): string {
  const inheritedFields = project.custom_fields.filter(f => f.inherited && f.value);
  const inheritedWarning = inheritedFields.length > 0
    ? `\n⚠️ 継承フィールド（要確認）: ${inheritedFields.map(f => f.label).join('、')}`
    : '';

  // 全フィールド（組み込み + カスタム）を section でグループ化してプロンプトに展開
  const sectionMap = new Map<string, typeof project.custom_fields>();
  for (const f of project.custom_fields) {
    const sec = f.section || '詳細';
    if (!sectionMap.has(sec)) sectionMap.set(sec, []);
    sectionMap.get(sec)!.push(f);
  }

  const coreFields = `種別: ${projectTypeLabel(project.type)}`;

  const customFieldsText = sectionMap.size > 0
    ? '\n\n' + Array.from(sectionMap.entries()).map(([sec, fields]) => {
        const lines = fields.map(f => {
          const flag = f.inherited ? ' [継承・要確認]' : '';
          const content = formatCustomFieldValue(f);
          return `- ${f.label}${flag}: ${content}`;
        }).join('\n');
        return `【${sec}】\n${lines}`;
      }).join('\n\n')
    : '';

  const companyRecord = globalAssets.objects.find(object => object.key === 'company-profile')?.records[0];
  const brandRecord = globalAssets.objects.find(object => object.key === 'brand-guidelines')?.records[0];
  const objectsText = globalAssets.objects.length > 0
    ? '\n\n【Global Asset Objects】\n' + globalAssets.objects.map((object) => {
        const recordsText = object.records.length > 0
          ? object.records.map((record, index) => {
              const values = object.fields.map((field) =>
                `  - ${field.label}: ${record.values[field.key] || '（未入力）'}`
              ).join('\n');
              return `■ レコード ${index + 1}\n${values}`;
            }).join('\n')
          : '■ レコードなし';
        return `【${object.name}】\n説明: ${object.description || '（未設定）'}\n${recordsText}`;
      }).join('\n\n')
    : '\n\n【Global Asset Objects】\n（未設定）';

  return `
============================
会社・ブランド情報（Global Assets）
============================
会社名: ${companyRecord?.values.company_name || '（未設定）'}
会社概要: ${companyRecord?.values.company_description || '（未設定）'}
ブランドボイス: ${brandRecord?.values.brand_voice || '（未設定）'}
ブランドガイドライン: ${brandRecord?.values.brand_guidelines || '（未設定）'}
${objectsText}

============================
プロジェクト情報
============================
名称: ${project.name}
${coreFields}
${customFieldsText}
${inheritedWarning}
`.trim();
}

export function buildContentPrompt(
  contentTemplate: ProjectContentTemplate,
  context: string,
  additionalInstruction = ''
): string {
  const channelLabel = contentTemplate.channel === 'その他'
    ? (contentTemplate.channel_other || 'その他')
    : contentTemplate.channel;
  const textFormatLabel = contentTemplate.text_format === 'plain' ? 'プレーンテキスト' : 'Markdown';

  return `以下のプロジェクト情報をもとに、「${contentTemplate.name}」を生成してください。

${context}

## コンテンツ定義
- 想定チャネル: ${channelLabel || '未設定'}
- テキスト形式: ${textFormatLabel}
- トーン: ${contentTemplate.tone || '未設定'}
- 必須要素: ${contentTemplate.mandatory_elements || '未設定'}
- 望ましい構成例: ${contentTemplate.example_structure || '未設定'}

## 個別生成指示
${contentTemplate.instruction}

${additionalInstruction ? `\n## 実行時の追加指示\n${additionalInstruction}` : ''}

## 出力要件
- 読み手にとってそのまま使える完成度で出力すること
- 情報が不足する場合は、推測ではなく不足点を明記すること
- 出力末尾に [⚠️ 整合性チェック] セクションを置き、使用した日付・数字・スペックの根拠を箇条書きで列挙すること`;
}

export function buildCompletionPrompt(project: ProjectWithFields, globalAssets: GlobalAssets, emptyFields: CustomField[]): string {
  const context = buildProjectContext(project, globalAssets);
  const fieldList = emptyFields.map(f => `- id: ${f.id}, ラベル: 「${f.label}」, 種別: ${f.type}`).join('\n');

  return `
以下のプロジェクト情報を分析し、未入力のフィールドに対して論理的に推測できる値を提案してください。

${context}

## 補完対象フィールド（未入力）
${fieldList}

## 出力形式（必ずJSON配列で返すこと）

\`\`\`json
[
  {
    "field_id": "フィールドID",
    "label": "フィールドラベル",
    "suggested_value": "提案する値（確信度が低い場合は「？」を末尾に付与）",
    "reason": "なぜその値を提案するかの根拠（20〜50字）"
  }
]
\`\`\`

提供されたデータから推測できない場合は、そのフィールドをリストに含めないこと。`;
}

export function parseCompletionResponse(raw: string): CompletionSuggestion[] {
  const match = raw.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) return [];
  try {
    return JSON.parse(match[1]) as CompletionSuggestion[];
  } catch {
    return [];
  }
}

export function extractWarnings(content: string): string[] {
  const section = content.match(/\[⚠️ 整合性チェック\]([\s\S]*?)$/);
  if (!section) return [];
  return section[1].trim().split('\n').filter(l => l.trim().startsWith('-')).map(l => l.trim());
}

export { SYSTEM_PROMPT };

function safeJson<T>(str: string | undefined | null, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

function formatCustomFieldValue(field: CustomField): string {
  if (field.type === 'group') {
    const options = safeJson<{ children?: Array<{ key: string; label: string }> }>(field.options, {});
    const values = safeJson<Record<string, { value?: string } | string>>(field.value, {});
    const childLines = (options.children ?? []).map((child) => {
      const childId = (child as { id?: string }).id;
      const raw = (childId ? values[childId] : undefined) ?? values[child.key];
      const value = typeof raw === 'string' ? raw : raw?.value || '';
      return `  - ${child.label}: ${value || '（未入力）'}`;
    });
    return childLines.length > 0 ? `\n${childLines.join('\n')}` : '（未入力）';
  }

  if (field.type === 'group_list') {
    const options = safeJson<{ children?: Array<{ key: string; label: string }> }>(field.options, {});
    const values = safeJson<Array<Record<string, { value?: string } | string>>>(field.value, []);
    if (values.length === 0) return '（未入力）';
    return `\n${values.map((item, index) => {
      const childLines = (options.children ?? []).map((child) => {
        const childId = (child as { id?: string }).id;
        const raw = (childId ? item[childId] : undefined) ?? item[child.key];
        const value = typeof raw === 'string' ? raw : raw?.value || '';
        return `    - ${child.label}: ${value || '（未入力）'}`;
      }).join('\n');
      return `  - ${index + 1}件目\n${childLines}`;
    }).join('\n')}`;
  }

  if (field.crawled_content) {
    return `${field.value}\n  [URL取得内容]: ${field.crawled_content.substring(0, 800)}...`;
  }

  return field.value || '（未入力）';
}

function projectTypeLabel(type: string): string {
  const map: Record<string, string> = {
    event: 'イベント',
    campaign: 'キャンペーン',
    content: 'コンテンツ制作',
    other: 'その他',
  };
  return map[type] ?? type;
}
