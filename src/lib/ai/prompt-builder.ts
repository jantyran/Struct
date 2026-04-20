import type { GlobalAssets, ProjectWithFields, CustomField, CompletionSuggestion, ProjectContentTemplate, GlobalAssetRecord, ProjectNote } from '@/types';
import { customFieldReferenceKey, globalObjectReferenceKey } from '@/lib/ai/reference-sources';

const SYSTEM_PROMPT = `あなたはプロフェッショナルなマーケティングストラテジストです。
提供されたプロジェクトデータとブランド情報のみを根拠として、高品質なマーケティングコンテンツを生成します。

厳守すべき制約：
1. 提供されたデータに記載のない日付・数字・スペック・実績を推測・捏造しないこと
2. [継承・要確認] フラグのついたフィールドを使用する場合、出力の末尾に警告を記載すること
3. ブランドボイスとガイドラインに厳密に従うこと
4. 日本語で出力すること（指定がない限り）`;

type BuildProjectContextOptions = {
  selectedSourceKeys?: string[];
};

export function buildProjectContext(project: ProjectWithFields, globalAssets: GlobalAssets, options: BuildProjectContextOptions = {}): string {
  const selectedSourceKeys = new Set(options.selectedSourceKeys || []);
  const useAllSources = selectedSourceKeys.size === 0;
  const isEnabled = (key: string) => useAllSources || selectedSourceKeys.has(key);

  const visibleFields = project.custom_fields.filter((field) => isEnabled(customFieldReferenceKey(field)));
  const inheritedFields = visibleFields.filter(f => f.inherited && f.value);
  const inheritedWarning = inheritedFields.length > 0
    ? `\n⚠️ 継承フィールド（要確認）: ${inheritedFields.map(f => f.label).join('、')}`
    : '';

  // 全フィールド（組み込み + カスタム）を section でグループ化してプロンプトに展開
  const sectionMap = new Map<string, typeof visibleFields>();
  for (const f of visibleFields) {
    const sec = f.section || '詳細';
    if (!sectionMap.has(sec)) sectionMap.set(sec, []);
    sectionMap.get(sec)!.push(f);
  }

  const coreFields = isEnabled('project-core')
    ? `名称: ${project.name}\n種別: ${projectTypeLabel(project.type)}\nフェーズ: ${project.phase_key || '（未設定）'}\nステータス: ${project.status || '（未設定）'}`
    : '';

  const customFieldsText = sectionMap.size > 0
    ? '\n\n' + Array.from(sectionMap.entries()).map(([sec, fields]) => {
        const lines = fields.map(f => {
          const flag = f.inherited ? ' [継承・要確認]' : '';
          const content = formatCustomFieldValueWithOptions(
            f,
            globalAssets,
            isEnabled('reference-records'),
            isEnabled('url-crawled-content'),
          );
          return `- ${f.label}${flag}: ${content}`;
        }).join('\n');
        return `【${sec}】\n${lines}`;
      }).join('\n\n')
    : '';

  const selectedGlobalObjects = globalAssets.objects.filter((object) => isEnabled(globalObjectReferenceKey(object.id)));
  const companyRecord = selectedGlobalObjects.find(object => object.key === 'company-profile')?.records[0];
  const brandRecord = selectedGlobalObjects.find(object => object.key === 'brand-guidelines')?.records[0];
  const objectsText = selectedGlobalObjects.length > 0
    ? '\n\n【マスターデータ】\n' + selectedGlobalObjects.map((object) => {
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
    : '';

  const notesText = isEnabled('project-notes') && (project.project_notes?.length ?? 0) > 0
    ? '\n\n【プロジェクトノート】\n' + project.project_notes!.map((note, index) => (
        `- ${index + 1}. ${note.title || '無題'}: ${(note.body || '').trim() || '（本文なし）'}`
      )).join('\n')
    : '';

  const generatedAssetsText = isEnabled('generated-assets') && (project.generated_assets?.length ?? 0) > 0
    ? '\n\n【生成済みコンテンツ】\n' + project.generated_assets!.map((asset, index) => (
        `- ${index + 1}. ${asset.title} (${asset.asset_type})\n${asset.content.slice(0, 800)}${asset.content.length > 800 ? '...' : ''}`
      )).join('\n\n')
    : '';

  return `
============================
会社・ブランド情報（マスターデータ）
============================
${selectedGlobalObjects.length > 0 ? `会社名: ${companyRecord?.values.company_name || '（未設定）'}
会社概要: ${companyRecord?.values.company_description || '（未設定）'}
ブランドボイス: ${brandRecord?.values.brand_voice || '（未設定）'}
ブランドガイドライン: ${brandRecord?.values.brand_guidelines || '（未設定）'}` : '（未設定）'}
${objectsText}

============================
プロジェクト情報
============================
${coreFields}
${customFieldsText}
${notesText}
${generatedAssetsText}
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

export function buildCompletionPrompt(
  project: ProjectWithFields,
  globalAssets: GlobalAssets,
  emptyFields: CustomField[],
  additionalInstruction = '',
  referenceNotes: ProjectNote[] = [],
): string {
  const context = buildProjectContext(project, globalAssets);
  const fieldList = emptyFields.map(f => `- id: ${f.id}, ラベル: 「${f.label}」, 種別: ${f.type}`).join('\n');

  const notesSection = referenceNotes.length > 0
    ? `\n## 参照ノート\n${referenceNotes.map((n, i) => `### ${i + 1}. ${n.title || '無題'}\n${n.body || '（本文なし）'}`).join('\n\n')}\n`
    : '';

  const additionalSection = additionalInstruction.trim()
    ? `\n## 追加指示\n${additionalInstruction.trim()}\n`
    : '';

  return `
以下のプロジェクト情報を分析し、未入力のフィールドに対して論理的に推測できる値を提案してください。

${context}
${notesSection}
## 補完対象フィールド（未入力）
${fieldList}
${additionalSection}
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
  // ```json ... ``` を優先、次に ``` ... ```、最後に [ ... ] を直接探す
  const jsonBlock = raw.match(/```json\s*([\s\S]*?)\s*```/) ?? raw.match(/```\s*(\[[\s\S]*?\])\s*```/);
  const candidate = jsonBlock ? jsonBlock[1] : (raw.match(/(\[[\s\S]*\])/) ?? [])[1];
  if (!candidate) return [];
  try {
    const parsed = JSON.parse(candidate);
    return Array.isArray(parsed) ? parsed as CompletionSuggestion[] : [];
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
  return formatCustomFieldValueWithOptions(field, null, true, true);
}

function formatCustomFieldValueWithOptions(
  field: CustomField,
  globalAssets: GlobalAssets | null,
  includeReferenceRecords: boolean,
  includeUrlCrawledContent: boolean,
): string {
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

  if (includeReferenceRecords && globalAssets && (field.type === 'reference' || field.type === 'reference_multi')) {
    const referenceText = formatReferenceFieldDetails(field, globalAssets);
    if (referenceText) return referenceText;
  }

  if (includeUrlCrawledContent && field.crawled_content) {
    return `${field.value}\n  [URL取得内容]: ${field.crawled_content.substring(0, 800)}...`;
  }

  return field.value || '（未入力）';
}

function formatReferenceFieldDetails(field: CustomField, globalAssets: GlobalAssets): string | null {
  const options = safeJson<{
    referenceObjectId?: string;
    referenceRecordKey?: string;
    referenceRecordKeys?: string[];
  }>(field.options, {});
  const referenceObject = globalAssets.objects.find((object) => object.id === options.referenceObjectId);
  if (!referenceObject) return null;

  const recordKeys = field.type === 'reference'
    ? [options.referenceRecordKey].filter((value): value is string => Boolean(value))
    : Array.isArray(options.referenceRecordKeys)
      ? options.referenceRecordKeys.filter((value): value is string => Boolean(value))
      : [];
  const selectedRecords = referenceObject.records.filter((record) => recordKeys.includes(record.key));
  if (selectedRecords.length === 0) return field.value || '（未入力）';

  return [
    field.value || '（未入力）',
    ...selectedRecords.map((record) => formatReferenceRecord(referenceObject.name, record)),
  ].join('\n');
}

function formatReferenceRecord(objectName: string, record: GlobalAssetRecord) {
  const detail = Object.entries(record.values)
    .map(([key, value]) => `    - ${key}: ${value || '（未入力）'}`)
    .join('\n');
  return `  [関連オブジェクト: ${objectName} / ${record.name}]\n${detail}`;
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
