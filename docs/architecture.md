# Struct アーキテクチャメモ

## 1. プロジェクト概要

Struct は、マーケティング施策の情報を構造化して保存し、過去案件の複製と AI 生成を支えるアプリです。

中心コンセプトは README にもある 3 層構造です。

- Global Assets
  - 会社全体で共有するブランド情報、会社説明、製品情報
- Project Core
  - 各案件の基本メタ情報
- Project Custom
  - 案件固有の追加項目。入力自由度が高く、URL クロールにも対応

この設計により、施策を単発の文章ではなく「再利用可能な構造」として保持し、複製や AI 再生成に流用できるようにしている。

## 2. 技術スタック

実装から確認できた構成は以下です。

- フレームワーク
  - Next.js 14 App Router
- 言語
  - TypeScript
- UI
  - React 18
  - Tailwind CSS
- AI
  - Anthropic SDK
  - モデル指定: `claude-haiku-4-5-20251001`
- HTML 抽出
  - `cheerio`
- ID 生成
  - `uuid`
- 永続化
  - JSON ファイルベース
  - 実体は `data/struct.json`

注意:

- README には SQLite と `better-sqlite3` の記載があるが、現行実装は SQLite ではない
- `package.json` にも `better-sqlite3` は存在しない
- `src/lib/db/index.ts` は SQL 風 API を持つ JSON ストアのラッパーになっている

## 3. ディレクトリ構成

主要構成は以下です。

```text
.
├── README.md
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── docs/
│   ├── README.md
│   └── architecture.md
└── src/
    ├── app/
    │   ├── api/
    │   │   ├── global-assets/route.ts
    │   │   ├── projects/route.ts
    │   │   └── projects/[id]/
    │   │       ├── route.ts
    │   │       ├── assets/route.ts
    │   │       ├── clone/route.ts
    │   │       ├── complete/route.ts
    │   │       ├── crawl/route.ts
    │   │       └── generate/route.ts
    │   ├── global-assets/page.tsx
    │   ├── layout.tsx
    │   ├── page.tsx
    │   └── projects/[id]/page.tsx
    ├── lib/
    │   ├── ai/
    │   │   ├── client.ts
    │   │   └── prompt-builder.ts
    │   ├── crawler.ts
    │   └── db/index.ts
    └── types/index.ts
```

責務の切り分けは比較的明快です。

- `src/app`
  - 画面と API ルート
- `src/lib/db`
  - 永続化
- `src/lib/ai`
  - AI クライアントとプロンプト生成
- `src/lib/crawler.ts`
  - URL からの本文抽出
- `src/types`
  - ドメイン型とラベル定義

## 4. 画面構成

### 4.1 ルートレイアウト

`src/app/layout.tsx`

- 左サイドバー固定
- ナビは `ダッシュボード` と `Global Assets`
- 右側が各ページ本体

### 4.2 ダッシュボード

`src/app/page.tsx`

役割:

- プロジェクト一覧表示
- 新規作成
- クローン開始
- フィルタリング

主要 UI:

- `NewProjectModal`
  - プロジェクト名と種別を入力して `POST /api/projects`
- `CloneModal`
  - 複製元と `include_values` を指定して `POST /api/projects/:id/clone`
- `ProjectCard`
  - 一覧上の概要表示と遷移

### 4.3 Global Assets 編集画面

`src/app/global-assets/page.tsx`

役割:

- 会社情報編集
- ブランドボイス編集
- ブランドガイドライン編集
- 製品情報の追加、削除、編集

保存先:

- `PUT /api/global-assets`

### 4.4 プロジェクト詳細画面

`src/app/projects/[id]/page.tsx`

役割:

- Project Core 編集
- Custom Field の追加、削除、更新
- URL 型フィールドのクロール実行
- AI 補完の提案取得
- AI によるアセット生成
- 生成済みアセット確認と削除

画面は大きく 3 つに分かれる。

- 上部ヘッダー
  - プロジェクト名、状態保存、削除
- 左ペイン
  - フィールド編集または生成済みアセット一覧
- 右ペイン
  - AI 生成パネル

## 5. データモデル

型定義は `src/types/index.ts` にまとまっている。

### 5.1 Project

案件本体。

主な項目:

- `id`
- `name`
- `type`
- `status`
- `cloned_from`
- `target`
- `start_date`
- `end_date`
- `budget`
- `channels`
- `description`

注意:

- `channels` は配列ではなく JSON 文字列で保持している

### 5.2 CustomField

案件ごとの追加フィールド。

主な項目:

- `key`
- `label`
- `type`
- `value`
- `options`
- `inherited`
- `inherited_from`
- `crawled_content`
- `sort_order`

特徴:

- `type` は `text | textarea | url | date | select`
- `url` 型はクロール可能
- クローン時に値を引き継いだ項目は `inherited = 1` で警告対象になる

### 5.3 GlobalAssets

全案件共通情報。

主な項目:

- `company_name`
- `company_description`
- `brand_voice`
- `brand_guidelines`
- `products`

### 5.4 GeneratedAsset

AI の生成結果。

主な項目:

- `asset_type`
- `title`
- `content`
- `warnings`
- `created_at`

## 6. 永続化の仕組み

実装ファイル: `src/lib/db/index.ts`

現行の永続化は JSON ファイル 1 つで完結する。

- 保存先: `data/struct.json`
- 管理対象:
  - `global_assets`
  - `projects`
  - `custom_fields`
  - `generated_assets`

特徴:

- 起動時ではなくアクセス時に `read()` される
- DB ファイルが存在しなければ初期 JSON を自動作成
- API 側からは `prepare().get() / all() / run()` を通して使う
- SQL 文はパーサではなく、文字列パターンで分岐している

設計上の含意:

- SQLite ライクな API を先に定義しているため、将来的な本物の DB 置換は比較的しやすい
- 一方で、現在の実装は SQL の自由度がなく、想定外のクエリには対応できない
- 同時更新やトランザクション制御は実質ない

## 7. API 構成

### 7.1 Global Assets

`src/app/api/global-assets/route.ts`

- `GET /api/global-assets`
  - 共通ブランド情報取得
- `PUT /api/global-assets`
  - 共通ブランド情報更新

### 7.2 Projects 一覧

`src/app/api/projects/route.ts`

- `GET /api/projects`
  - 一覧取得
- `POST /api/projects`
  - 新規作成

### 7.3 Project 詳細

`src/app/api/projects/[id]/route.ts`

- `GET /api/projects/:id`
  - Project 本体と Custom Fields を返す
- `PUT /api/projects/:id`
  - Project 更新
  - Custom Fields の同期
- `DELETE /api/projects/:id`
  - Project、関連 Field、GeneratedAsset を削除

注意:

- `PUT` 時に `custom_fields` 全体を同期する実装なので、部分更新ではなく実質フル置換に近い

### 7.4 Project Clone

`src/app/api/projects/[id]/clone/route.ts`

- `POST /api/projects/:id/clone`

役割:

- 元案件をコピーして新規案件を作成
- `include_values` によって以下を切り替える
  - `false`: 定義のみ複製
  - `true`: 値も複製

クローン時の特徴:

- 値を引き継いだ Custom Field は `inherited = 1`
- 生成前にユーザーが再確認すべき情報として UI に出る

### 7.5 Crawl

`src/app/api/projects/[id]/crawl/route.ts`

- `POST /api/projects/:id/crawl`

役割:

- `url` 型フィールドの URL 先本文を抽出し `crawled_content` に保存

### 7.6 Completion

`src/app/api/projects/[id]/complete/route.ts`

- `POST /api/projects/:id/complete`

役割:

- 未入力の Custom Field に対して AI 補完候補を出す
- 実保存はしない
- UI 側でユーザーが提案を適用してから保存する

### 7.7 Generate

`src/app/api/projects/[id]/generate/route.ts`

- `POST /api/projects/:id/generate`

役割:

- 指定アセット種別ごとに AI 生成
- 生成結果を `generated_assets` に保存

### 7.8 Assets

`src/app/api/projects/[id]/assets/route.ts`

- `GET /api/projects/:id/assets`
  - 生成済みアセット一覧
- `DELETE /api/projects/:id/assets?assetId=...`
  - 単体削除
- `DELETE /api/projects/:id/assets`
  - 全削除

## 8. AI 生成フロー

AI 関連の中核は以下。

- `src/lib/ai/client.ts`
- `src/lib/ai/prompt-builder.ts`

### 8.1 基本フロー

1. Global Assets と Project 情報を取得
2. `buildProjectContext()` で共通コンテキスト文字列を組み立てる
3. 用途別に `buildAssetPrompt()` または `buildCompletionPrompt()` を作る
4. `generateText()` で Anthropic API を呼ぶ
5. 必要に応じてレスポンスを保存またはパースする

### 8.2 システムプロンプトの意図

`SYSTEM_PROMPT` では以下を厳守させている。

- 提供データにない数字や実績を捏造しない
- 継承フィールドを使う場合は警告を出す
- ブランドボイスとガイドラインに従う
- 日本語で出力する

### 8.3 生成できるアセット種別

- `lp`
- `dm`
- `sns_twitter`
- `sns_linkedin`
- `ad_copy`
- `email`
- `report`

### 8.4 整合性チェック

各生成テンプレートは末尾に `[⚠️ 整合性チェック]` セクションを要求している。

その後 `extractWarnings()` が以下を行う。

- 該当セクションを抽出
- `-` で始まる行のみ warnings として保存

このため、AI 出力が想定フォーマットから外れると warnings が空になる可能性がある。

### 8.5 補完フロー

未入力フィールドに対しては JSON 配列を返すように AI に要求している。

返却後は `parseCompletionResponse()` が以下を行う。

- ```json fenced block を抽出
- JSON.parse
- パース失敗時は空配列

つまり、補完機能は出力フォーマット依存が強い。

## 9. URL クロールの仕組み

実装ファイル: `src/lib/crawler.ts`

流れ:

1. 指定 URL を `fetch`
2. `cheerio` で HTML をロード
3. ナビ、広告、モーダルなどを除去
4. `main`, `article`, `body` などから本文を抽出
5. 4000 文字までに切り詰めて保存

特徴:

- ページ本文の要約ではなく、生テキスト寄りの抽出
- クロール結果は Custom Field の `crawled_content` に保存
- AI コンテキストへ最大 800 文字分だけ埋め込まれる

## 10. UI とバックエンドの主なデータフロー

### 10.1 プロジェクト作成

1. ダッシュボードで新規作成
2. `POST /api/projects`
3. 作成後に `/projects/:id` へ遷移

### 10.2 プロジェクト保存

1. 詳細画面で入力
2. `PUT /api/projects/:id`
3. Project と Custom Fields をまとめて同期

### 10.3 補完提案

1. 詳細画面で `AI補完を実行`
2. `POST /api/projects/:id/complete`
3. 提案を UI に表示
4. ユーザーが適用
5. 保存時に永続化

### 10.4 コンテンツ生成

1. 生成対象アセットを選択
2. 事前に保存
3. `POST /api/projects/:id/generate`
4. AI 出力を保存
5. `assets` タブへ移動

## 11. 実装上の注意点と改善候補

現状コードから見える注意点です。

### 11.1 README と実装の差分

- README は SQLite 前提だが、実装は JSON ファイルストア
- セットアップ説明と実装実態に差がある

### 11.2 DB ラッパーの制約

- SQL 文字列の解釈がパターン一致ベース
- 想定外クエリに弱い
- 排他制御がない
- データ量増加時の性能は限定的

### 11.3 API 型と実データのズレ

- `GeneratedAsset` 型では `warnings` は `string`
- ただし `GET /api/projects/:id/assets` は `warnings` を配列に変換して返している
- フロント側では JSON 文字列として再パースしている箇所があり、実ランタイムの整合性を一度見直した方がよい

### 11.4 `PUT /api/projects/:id` の更新方式

- Custom Fields は全件同期
- 同時編集や部分更新には弱い

### 11.5 AI 出力フォーマット依存

- warnings 抽出も補完 JSON 抽出も、AI が所定フォーマットを守る前提
- フォーマット逸脱時の回復処理は薄い

## 12. 今後ドキュメント化するとよいもの

次に必要になりやすいのは以下。

- `data/struct.json` の実データスキーマ例
- API リクエストとレスポンスの具体例
- AI プロンプト改善ルール
- JSON ストアから SQLite へ戻す場合の移行方針

## 13. 関連ファイル

- `README.md`
- `src/app/page.tsx`
- `src/app/projects/[id]/page.tsx`
- `src/app/global-assets/page.tsx`
- `src/app/api/projects/route.ts`
- `src/app/api/projects/[id]/route.ts`
- `src/app/api/projects/[id]/clone/route.ts`
- `src/app/api/projects/[id]/complete/route.ts`
- `src/app/api/projects/[id]/generate/route.ts`
- `src/app/api/projects/[id]/crawl/route.ts`
- `src/app/api/projects/[id]/assets/route.ts`
- `src/app/api/global-assets/route.ts`
- `src/lib/db/index.ts`
- `src/lib/ai/client.ts`
- `src/lib/ai/prompt-builder.ts`
- `src/lib/crawler.ts`
- `src/types/index.ts`

