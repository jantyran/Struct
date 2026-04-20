# UX/UI 視覚的階層 改修ドキュメント

## 問題の本質

現状のUIでは「クリックできる要素」「編集できる要素」「表示専用データ」が同一の視覚語彙（白背景 + rounded-xl + border + p-3）を使っており、ユーザーがどこを操作できるか直感的に判別できない。

---

## 現状パターン分析

| 用途 | 現在のスタイル | 問題 |
|---|---|---|
| 編集フィールド（`field-input`） | 白背景 + border + focus ring | ✅ 分かりやすい |
| フィールド行コンテナ（`CustomFieldRow`） | `rounded-xl border p-3 bg-white/62` | ⚠ 内側のinputと区別しにくい |
| 表示専用ウィジェット（`SectionInfoWidget`） | 同上 | ❌ 編集できるように見える |
| クリック可能なカード（`ProjectCard`） | `.card` + hover:-translate | ⚠ クリック領域が「開く」ボタンのみ |
| 統計カード（total/active/draft） | `.card p-4` | ❌ クリック不可だがカードと同一スタイル |
| アコーディオン見出しボタン | テキストのみ + ▲▼ | ❌ ホバー状態なし、クリック可能と分からない |
| タブボタン | インラインスタイル | ⚠ 非アクティブ時の hover なし |
| チェックボックス行 | label素のみ | ⚠ クリック可能と分かりにくい |

---

## 設計原則

### 3層の視覚サーフェス

```
Layer A — 表示専用（Surface Read）
  → 薄い青灰色背景、ヘアライン border、cursor: default
  → "ここはデータが置いてあるだけ" を伝える

Layer B — インタラクティブ行/カード（Interactive）
  → hover: 背景が白に近づく or 影が上がる、cursor: pointer
  → "ここは操作できる" を明示

Layer C — 編集入力（Edit Input）
  → 白背景 + border + focus ring（既存 .field-input）
  → "ここに入力できる" を明示
```

### クリック領域の原則

- カード全体がリンクなら、`<Link>` or `<button>` でカード全体を包む
- 操作ボタンが内側にある場合は `e.stopPropagation()` で分離
- 行全体がクリッカブルなら行全体にhover背景を付与

---

## 新規 CSS ユーティリティ（globals.css に追加）

### `.surface-read`
表示専用データコンテナ。インタラクションなし。

```css
background: rgba(241, 248, 252, 0.55);
border: 1px solid rgba(216, 231, 239, 0.5);
border-radius: 0.75rem;
padding: 0.75rem;
```

### `.card-link`
カード全体がクリック対象になる場合の上書き。

```css
cursor: pointer;
transition: box-shadow 0.18s, transform 0.12s;
/* hover: shadow up + translate */
```

### `.row-hover`
リスト行・アコーディオン見出しなど、行全体がクリッカブルな場合。

```css
cursor: pointer;
transition: background-color 0.15s;
/* hover: 背景が白に近づく */
```

### `.tab-btn`
タブナビゲーションの共通スタイル（active / inactive 両状態）。

### `.field-section-card`
`CustomFieldRow` の外枠専用。内部の `field-input` との区別を明確化するため、左にアクセントカラーバーを付与。

---

## 実装対象コンポーネント

### 1. `globals.css`
上記ユーティリティクラスを追加。

### 2. `src/app/page.tsx`（ダッシュボード）
- `ProjectCard`: カード全体を `<Link>` でラップ、`.card-link` 適用。「クローン」ボタンは `stopPropagation`。
- 統計カード: `.card` → `.surface-read` に変更（クリック不可を明示）。

### 3. `src/app/projects/[id]/page.tsx`（プロジェクト詳細）
- `SectionInfoWidget`: `rounded-xl border p-3` → `.surface-read`
- タブボタン: `.tab-btn` 適用
- フィールドセクション見出しボタン: `.row-hover` 適用
- `CustomFieldRow` 外枠: `.field-section-card` 適用

### 4. `src/app/project-types/page.tsx`（プロジェクト種別設定）
- `DefinitionAccordionSection` ボタン: `.row-hover` 適用
- 定義アコーディオン（種別展開ボタン）: `.row-hover` 適用
- コンテンツテンプレートチェックボックス行: hover 背景追加

### 5. `src/app/settings/content-templates/page.tsx`（生成コンテンツ設定）
- `ContentTemplateRow` ヘッダーボタン: `.row-hover` 適用

---

## Before / After イメージ（テキスト）

```
Before:
  [白背景+border] フィールド行コンテナ
    [白背景+border] input "テキスト入力"   ← どっちが入力欄か不明

After:
  [薄青灰+左accent] フィールド行コンテナ（.field-section-card）
    [白背景+border] input "テキスト入力"   ← inputだけが白くて明確

---

Before:
  [白背景+border] 種別ウィジェット（表示のみ）
  [白背景+border] 入力フィールド（編集可）
  ← 見た目が同じで区別不能

After:
  [薄青灰 .surface-read] 種別ウィジェット（表示のみ）
  [白背景+border .field-input] 入力フィールド（編集可）
  ← ひと目で役割が分かる

---

Before:
  [.card] 統計カード（クリック不可）
  [.card hover:-translate] プロジェクトカード（クリック可）
  ← ホバー以外で区別できない

After:
  [.surface-read] 統計カード（クリック不可）
  [.card .card-link] プロジェクトカード（カード全体がリンク）
  ← 見ただけで操作可能性が分かる
```

---

## 変更しないもの

- `field-input` の既存スタイル（ここは正しい）
- `btn-primary` / `btn-secondary` / `btn-danger`（明確に機能している）
- カラーパレット（`--accent`, `--text-primary` 等）
- Markdown ビューア（`.md-body`）
