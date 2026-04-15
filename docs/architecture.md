# Struct アーキテクチャメモ

## 1. 概要

Struct は `MKTキャンペーン運用デスク` として使う、認証付きのキャンペーン管理アプリです。  
キャンペーンやイベントの進行、構造化データ、生成コンテンツ、AI 利用設定をユーザー単位またはプロジェクト単位で管理します。

アプリは次の 3 系統の情報を扱います。

- ユーザー単位の設定とマスターデータ
  - Global Assets
  - プロジェクト種別定義
  - 生成コンテンツ定義
  - AI 設定
- プロジェクト単位の運用データ
  - Project Core
  - フィールド値
  - フェーズ進行
  - 生成済みコンテンツ
  - メンバーと招待情報
- 公開向け情報
  - About
  - Guide

## 2. 技術スタック

- フレームワーク
  - Next.js 14 App Router
- 言語
  - TypeScript
- UI
  - React 18
  - Tailwind CSS
- 永続化
  - SQLite
  - `better-sqlite3`
- 認証
  - JWT
  - `jose`
  - `httpOnly` Cookie
- パスワードハッシュ
  - `bcryptjs`
- AI
  - Google Gemini
  - OpenAI API
  - Anthropic API
- HTML 抽出
  - `cheerio`
- ID 生成
  - `uuid`

## 3. 環境変数

実装上、重要なのは以下です。

- `JWT_SECRET`
  - セッション署名用
- `NEXT_PUBLIC_BASE_URL`
  - 招待 URL 生成に使用
  - 外部アクセス URL に合わせる
- `NEXT_PUBLIC_BASE_PATH`
  - 既定は空
  - サブパス配備時のみ使用

補足:

- AI API キーとモデル設定は `.env` ではなく `設定 > AI設定` に保存する

## 4. ディレクトリ構成

主要構成は以下です。

```text
.
├── README.md
├── docs/
│   ├── README.md
│   └── architecture.md
├── data/
│   └── struct.db
└── src/
    ├── app/
    │   ├── about/page.tsx
    │   ├── api/
    │   │   ├── ai-settings/route.ts
    │   │   ├── auth/
    │   │   ├── content-templates/route.ts
    │   │   ├── global-assets/route.ts
    │   │   ├── invites/[token]/
    │   │   ├── project-types/route.ts
    │   │   └── projects/
    │   ├── global-assets/page.tsx
    │   ├── global-assets/[objectId]/page.tsx
    │   ├── guide/page.tsx
    │   ├── layout.tsx
    │   ├── login/page.tsx
    │   ├── page.tsx
    │   ├── project-types/page.tsx
    │   ├── projects/[id]/page.tsx
    │   ├── settings/page.tsx
    │   ├── settings/ai/page.tsx
    │   ├── settings/content-templates/page.tsx
    │   └── signup/page.tsx
    ├── components/
    │   └── AuthContext.tsx
    ├── lib/
    │   ├── ai/
    │   ├── auth.ts
    │   ├── content-templates.ts
    │   ├── crawler.ts
    │   ├── db/index.ts
    │   ├── global-assets.ts
    │   ├── project-field-sync.ts
    │   └── project-types.ts
    └── types/index.ts
```

## 5. 画面構成

### 5.1 共通レイアウト

`src/app/layout.tsx`

- 左サイドバー上部に主要ナビ
- 下部に `設定`、メールアドレス、ログアウトを配置
- タイトル表記は `Struct` / `MKTキャンペーン運用デスク`
- 未ログイン時は公開向けリンクのみ表示

### 5.2 公開ページ

- `src/app/about/page.tsx`
  - サービス概要
- `src/app/guide/page.tsx`
  - 使い方

### 5.3 認証画面

- `src/app/login/page.tsx`
- `src/app/signup/page.tsx`

### 5.4 ダッシュボード

`src/app/page.tsx`

- 参照可能なプロジェクト一覧
- 新規作成モーダル
- 種別ごとの初期フェーズ表示
- ステータス / 種別フィルタ

### 5.5 Global Assets 一覧

`src/app/global-assets/page.tsx`

- オブジェクト一覧と追加
- 各オブジェクト詳細への導線

### 5.6 Global Assets 詳細

`src/app/global-assets/[objectId]/page.tsx`

- オブジェクト設定
- 項目設定
- レコード一覧と編集
- `参照` / `複数参照` による他オブジェクト参照

### 5.7 設定ハブ

`src/app/settings/page.tsx`

- AI 設定
- 生成コンテンツ設定
- プロジェクト設定

### 5.8 AI 設定

`src/app/settings/ai/page.tsx`

- プロバイダ選択
- モデル入力
- Base URL 入力
- API キー入力

### 5.9 生成コンテンツ設定

`src/app/settings/content-templates/page.tsx`

- アコーディオン形式
- 順番入れ替え
- チャネル選択
- テキスト形式選択
- トーン、必須要素、構成例、指示の管理

### 5.10 プロジェクト設定

`src/app/project-types/page.tsx`

- 種別ごとのアコーディオン UI
- 種別設定
- フェーズ設定
- フィールド設定
- セクション設定
- 利用する生成コンテンツの複数選択
- 項目定義と UI 配置定義を分離
- 項目設定ではラベル、キー、型、参照先、選択肢、子項目のみを編集
- セクション設定ではセクション順、項目の所属先、セクション内順、列幅を編集
- Salesforce 風に未配置ボックスと各セクション間でドラッグ&ドロップ配置する方針
- 未配置項目と配置済み項目は色分けで視認できるようにする
- `group` / `group_list` の子項目設定

### 5.11 プロジェクト詳細

`src/app/projects/[id]/page.tsx`

- 基本情報編集
- フェーズ Path UI
- 設定由来フィールドの値入力
- Global Assets 参照
- `group` / `group_list` 入力
- 生成コンテンツの選択、追加指示付き生成
- 生成済みコンテンツの直接編集
- 招待管理

### 5.12 招待画面

`src/app/invites/[token]/page.tsx`

- 招待トークン確認
- ログイン誘導
- 招待受諾後のプロジェクト参加

## 6. 認証と権限制御

### 6.1 セッション

`src/lib/auth.ts`

- `createSession(userId)` で JWT を発行
- Cookie 名は `session`
- `getSession()` で Cookie を検証し、現在ユーザーを返す
- `requireSession()` は未認証時に例外を投げる

### 6.2 権限モデル

- `global_assets` はユーザー単位で保持
- プロジェクトは `owner_id` を持つ
- `project_members` で共同編集対象を保持
- 招待発行と削除はオーナーのみ
- プロジェクト詳細、生成、クロール、アセット取得はオーナーまたはメンバーが可能

## 7. データモデル

型定義は `src/types/index.ts`、実体スキーマは `src/lib/db/index.ts` にあります。

### 7.1 users

- `id`
- `email`
- `password_hash`
- `name`
- `created_at`

### 7.2 global_assets

- `id`
- `user_id`
- `objects`
- `project_types`
- `content_templates`
- `ai_settings`
- `updated_at`

補足:

- `objects` は Global Assets オブジェクト定義とレコードの JSON
- `project_types` はプロジェクト種別定義の JSON
- `content_templates` は生成コンテンツ定義の JSON
- `ai_settings` は AI 設定の JSON
- 1 ユーザー 1 レコード前提

`project_types` の主な構成:

- `phases`
- `sections`
  - `name`
  - `color`
  - `items`
    - `field_id`
    - `layout`
- `field_templates`
  - 項目そのものの定義を保持
  - UI 配置情報は `sections.items` 側で扱う

### 7.3 GlobalAssetObject

- `id`
- `key`
- `name`
- `description`
- `fields`
- `records`

項目型:

- `text`
- `textarea`
- `url`
- `number`
- `date`
- `reference`
- `reference_multi`

### 7.4 projects

- `id`
- `name`
- `type`
- `phase_key`
- `status`
- `owner_id`
- `cloned_from`
- `target`
- `start_date`
- `end_date`
- `budget`
- `channels`
- `description`
- `created_at`
- `updated_at`

補足:

- `channels` は JSON 文字列で保存
- `phase_key` は現在フェーズを表す

### 7.5 project_members

- `id`
- `project_id`
- `user_id`
- `role`
- `created_at`

### 7.6 invitations

- `id`
- `project_id`
- `email`
- `token`
- `role`
- `status`
- `expires_at`
- `created_at`

### 7.7 custom_fields

- `id`
- `project_id`
- `template_id`
- `key`
- `label`
- `type`
- `value`
- `options`
- `layout`
- `inherited`
- `inherited_from`
- `crawled_content`
- `sort_order`

補足:

- `type` は `text | textarea | url | date | select | reference | reference_multi | group | group_list`
- `layout` は `half | full`
- `options` は型ごとの設定 JSON
- `group` / `group_list` は子項目定義を `options.children` に持つ
- `group` / `group_list` の値は `value` に JSON 文字列で保存する

### 7.8 generated_assets

- `id`
- `project_id`
- `asset_type`
- `title`
- `content`
- `warnings`
- `created_at`

補足:

- `asset_type` は固定列挙ではなく、生成コンテンツ定義の `key` ベース
- `warnings` は JSON 文字列

## 8. 設計方針

### 8.1 Global Assets とプロジェクト項目の役割分担

- 再利用・横断管理したいもの
  - Global Assets のオブジェクトで管理
- その案件だけで完結するまとまり
  - `group`
- その案件内で複数件持つまとまり
  - `group_list`

このため、Salesforce 的な参照モデルと、案件内だけで閉じるグループ入力を併用する設計にしている。

### 8.2 プロジェクト設定の反映

- プロジェクト種別の変更は既存プロジェクトにも反映する
- 反映対象
  - 順番
  - レイアウト
  - セクション所属
  - ラベル
  - キー
  - 型
  - 選択肢
  - 参照設定
- 値はプロジェクト側の入力値を保持する

同期は `src/lib/project-field-sync.ts` で扱う。

補足:

- 設定画面では `field_templates` と `sections.items` を分離して管理する
- プロジェクト実体の `custom_fields` には、描画しやすいよう `section` / `layout` / `sort_order` を展開して保持する
- 既存データの `field_templates.section` / `field_templates.layout` は、読み込み時に `sections.items` へ移行できる前提で扱う

### 8.3 読み取り時の自動再保存はしない

- `GET /api/projects/[id]` では同期結果を返すが、表示だけで DB 再保存はしない
- 実保存は `プロジェクト設定` 保存時またはプロジェクト保存時に行う
- これにより、詳細表示時の不要な書き込みを避けている

## 9. API 構成

### 9.1 認証

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### 9.2 設定 / マスターデータ

- `GET /api/global-assets`
- `PUT /api/global-assets`
- `GET /api/project-types`
- `PUT /api/project-types`
- `GET /api/content-templates`
- `PUT /api/content-templates`
- `GET /api/ai-settings`
- `PUT /api/ai-settings`

### 9.3 プロジェクト

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/[id]`
- `PUT /api/projects/[id]`
- `DELETE /api/projects/[id]`
- `POST /api/projects/[id]/clone`
- `POST /api/projects/[id]/crawl`
- `POST /api/projects/[id]/complete`
- `POST /api/projects/[id]/generate`
- `GET /api/projects/[id]/assets`
- `PATCH /api/projects/[id]/assets`
- `DELETE /api/projects/[id]/assets`
- `POST /api/projects/[id]/invite`

### 9.4 招待

- `GET /api/invites/[token]`
- `POST /api/invites/[token]/accept`

## 10. AI フロー

### 10.1 参照情報の組み立て

`src/lib/ai/prompt-builder.ts`

AI には次の情報を渡します。

- Global Assets
- Project Core
- フィールド値
- `group` / `group_list` の展開内容
- URL 取得済み本文
- 生成コンテンツ定義
- ユーザーが入力した追加指示

### 10.2 実行設定

`src/lib/ai/client.ts`

- `Gemini`
- `OpenAI`
- `Anthropic`

を設定に応じて切り替える。

### 10.3 生成対象

固定のアセット種別ではなく、`生成コンテンツ設定` で定義したテンプレートを対象とする。

生成コンテンツ定義の主要項目:

- `channel`
- `channel_other`
- `text_format`
- `tone`
- `mandatory_elements`
- `example_structure`
- `instruction`

### 10.4 AI 補完

未入力フィールド向けの補完提案 API は維持している。  
補完対象は現在のフィールド構造を前提に組み立てる。

## 11. 今後の実装予定

### 11.1 プロジェクト ToDo

目的:

- プロジェクトごとの日常タスク管理
- フェーズ進行と連動した実務の可視化

想定:

- プロジェクト詳細内で管理
- チェック状態、期限、担当メモなどを持てる構成を検討
- 案件進行中の作業ログに近い軽量運用を想定

### 11.2 プロジェクト ノート

目的:

- 打ち合わせメモ
- 意思決定の記録
- 補足情報の蓄積

想定:

- プロジェクト詳細内で管理
- 時系列または自由記述の運用を想定
- 打ち合わせ記録、判断理由、補足メモの蓄積先として使う

## 12. 実装上の注意

- `channels`、`options`、`warnings` は JSON 文字列で保存される
- `group` / `group_list` の `value` も JSON 文字列で保持する
- 招待 URL は `NEXT_PUBLIC_BASE_URL` に依存する
- `JWT_SECRET` は本番では必ず明示設定する
- AI 設定はユーザー単位で保存するため、サーバー全体の共通 API キー前提ではない
