import type { GlobalAssets, ProjectWithFields, CustomField, AssetType, CompletionSuggestion } from '@/types';

const SYSTEM_PROMPT = `あなたはプロフェッショナルなマーケティングストラテジストです。
提供されたプロジェクトデータとブランド情報のみを根拠として、高品質なマーケティングアセットを生成します。

厳守すべき制約：
1. 提供されたデータに記載のない日付・数字・スペック・実績を推測・捏造しないこと
2. [継承・要確認] フラグのついたフィールドを使用する場合、出力の末尾に警告を記載すること
3. ブランドボイスとガイドラインに厳密に従うこと
4. 日本語で出力すること（指定がない限り）`;

export function buildProjectContext(project: ProjectWithFields, globalAssets: GlobalAssets): string {
  const channels = safeJson<string[]>(project.channels, []);
  const products = globalAssets.products;

  const inheritedFields = project.custom_fields.filter(f => f.inherited && f.value);
  const inheritedWarning = inheritedFields.length > 0
    ? `\n⚠️ 継承フィールド（要確認）: ${inheritedFields.map(f => f.label).join('、')}`
    : '';

  const coreFields = [
    `種別: ${projectTypeLabel(project.type)}`,
    `ターゲット: ${project.target || '（未設定）'}`,
    `期間: ${project.start_date || '未定'} 〜 ${project.end_date || '未定'}`,
    `予算: ${project.budget || '（未設定）'}`,
    `チャネル: ${channels.length > 0 ? channels.join('、') : '（未設定）'}`,
    `概要: ${project.description || '（未設定）'}`,
  ].join('\n');

  const customFieldsText = project.custom_fields.length > 0
    ? '\n\n【カスタムフィールド】\n' + project.custom_fields.map(f => {
        const flag = f.inherited ? ' [継承・要確認]' : '';
        const content = f.crawled_content
          ? `${f.value}\n  [URL取得内容]: ${f.crawled_content.substring(0, 800)}...`
          : f.value || '（未入力）';
        return `- ${f.label}${flag}: ${content}`;
      }).join('\n')
    : '';

  const productsText = products.length > 0
    ? '\n\n【製品・サービス情報】\n' + products.map(p =>
        `■ ${p.name}\n  概要: ${p.description}\n  機能・特徴: ${p.features}\n  価格: ${p.price || '要問合せ'}`
      ).join('\n\n')
    : '';

  return `
============================
会社・ブランド情報（Global Assets）
============================
会社名: ${globalAssets.company_name || '（未設定）'}
会社概要: ${globalAssets.company_description || '（未設定）'}
ブランドボイス: ${globalAssets.brand_voice || '（未設定）'}
ブランドガイドライン: ${globalAssets.brand_guidelines || '（未設定）'}
${productsText}

============================
プロジェクト情報
============================
名称: ${project.name}
${coreFields}
${customFieldsText}
${inheritedWarning}
`.trim();
}

export function buildAssetPrompt(
  assetType: AssetType,
  context: string
): string {
  const templates: Record<AssetType, string> = {
    lp: `以下のプロジェクト情報を元に、ランディングページ（LP）の完全な構成案とコピーを作成してください。

${context}

## 出力形式（各セクションを「---」で区切ること）

[ファーストビュー]
ヘッドライン、サブヘッドライン、CTAボタンテキスト

---

[課題提起]
ターゲットの悩み・課題の共感文

---

[ソリューション]
製品・サービスがどう解決するかの説明

---

[特徴・ベネフィット]
3〜5つの主要ベネフィット（箇条書き）

---

[社会的証明]
（提供されたデータにある場合のみ記載。なければ「データなし」と明記）

---

[FAQ]
想定される3つの疑問と回答

---

[クロージングCTA]
最終的な行動喚起文

---

[⚠️ 整合性チェック]
使用した日付・数字・スペックの根拠を箇条書きで列挙`,

    dm: `以下のプロジェクト情報を元に、ダイレクトメール（DM）のコピーを作成してください。

${context}

## 出力形式

[件名]（30文字以内）

[書き出し]（個人的な語りかけ）

[本文]（課題→解決策→ベネフィットの流れで300〜500字）

[CTA]（明確な行動喚起と期限）

[署名]

---

[⚠️ 整合性チェック]
使用した日付・数字・スペックの根拠`,

    sns_twitter: `以下のプロジェクト情報を元に、Twitter/X投稿を3パターン作成してください。

${context}

## 出力形式（各ポストを「---」で区切ること）

[投稿A - 告知型]（140文字以内、ハッシュタグ含む）

---

[投稿B - 問いかけ型]（140文字以内）

---

[投稿C - ベネフィット訴求型]（140文字以内、ハッシュタグ含む）

---

[⚠️ 整合性チェック]`,

    sns_linkedin: `以下のプロジェクト情報を元に、LinkedIn投稿を作成してください。

${context}

## 出力形式

[タイトル行]（注目を集める1文）

[本文]（専門性を示しながら価値を伝える300〜500字）

[ハッシュタグ]（5個以内）

---

[⚠️ 整合性チェック]`,

    ad_copy: `以下のプロジェクト情報を元に、広告コピーを複数パターン作成してください。

${context}

## 出力形式（各パターンを「---」で区切ること）

[パターンA - 感情訴求]
ヘッドライン（20文字以内）
ボディコピー（50文字以内）
CTA（10文字以内）

---

[パターンB - 論理訴求]
ヘッドライン（20文字以内）
ボディコピー（50文字以内）
CTA（10文字以内）

---

[パターンC - 限定性訴求]
ヘッドライン（20文字以内）
ボディコピー（50文字以内）
CTA（10文字以内）

---

[⚠️ 整合性チェック]`,

    email: `以下のプロジェクト情報を元に、メールマガジンを作成してください。

${context}

## 出力形式

[件名]（30文字以内）
[プレヘッダー]（50文字以内）

[イントロ]（読者への語りかけ・2〜3文）

[メインコンテンツ]（価値提供・400〜600字）

[特典・オファー情報]（提供データがある場合のみ）

[CTA]

[フッター情報]

---

[⚠️ 整合性チェック]`,

    report: `以下のプロジェクト情報を元に、社内向け施策報告書を作成してください。

${context}

## 出力形式

[1. エグゼクティブサマリー]（3〜5行）

[2. 施策概要]
- 目的・背景
- ターゲット
- 実施期間・予算

[3. 実施内容]
- 各チャネルの施策詳細

[4. 期待される成果指標（KPI）]
（提供データに基づくもののみ。推測は明記）

[5. リスクと課題]

[6. アクションアイテム]

---

[⚠️ 整合性チェック]`,
  };

  return templates[assetType];
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

function safeJson<T>(str: string, fallback: T): T {
  try { return JSON.parse(str) as T; } catch { return fallback; }
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
