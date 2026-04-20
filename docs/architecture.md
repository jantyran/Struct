# Struct アーキテクチャメモ

## 1. 概要

Struct は `MKTキャンペーン運用デスク` として使う、認証付きのキャンペーン管理アプリです。  
キャンペーンやイベントの進行、構造化データ、生成コンテンツ、AI 利用設定を組織単位またはプロジェクト単位で管理します。

アプリは次の 3 系統の情報を扱います。

- 組織単位の設定とマスターデータ
  - Global Assets
  - プロジェクト種別定義
  - 生成コンテンツ定義
  - AI 設定
- プロジェクト単位の運用データ
  - Project Core
  - フィールド値
  - フェーズ進行
  - 生成済みコンテンツ
  - 主担当者
  - メンバーとプロジェクトロール
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

## 3.1 起動ポリシー

- `3002`
  - 開発確認用ポート
  - `npm run dev` で起動
  - コード変更をビルドなしで即時反映して確認する
- `38427`
  - 本番確認用ポート
  - `npm run build && npm run start` で起動
  - ビルド済み成果物で安定動作を確認する

補足:

- `NEXT_PUBLIC_BASE_URL` は招待URLなど外部共有前提のURL生成に使うため、通常は `38427` 側のURLを設定する
- 開発サーバーは `.next-dev`、本番サーバーは `.next` を使用し、互いのビルド成果物を汚染しない

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
│   │   ├── project-roles/route.ts
│   │   ├── project-types/route.ts
│   │   ├── roles/route.ts
│   │   ├── users/route.ts
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
    │   ├── settings/project-roles/page.tsx
    │   ├── settings/roles/page.tsx
    │   ├── settings/users/page.tsx
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
    │   ├── permissions.ts
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
- ユーザー管理
- システムロール設定
- プロジェクトロール設定

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
- メンバータブ
  - 主担当者の変更
  - 登録済みユーザーからプロジェクトメンバーを追加
  - プロジェクトロールの付与・変更
- 設定由来フィールドの値入力
- Global Assets 参照
- `group` / `group_list` 入力
- 生成コンテンツの選択、追加指示付き生成
- 生成済みコンテンツの直接編集

### 5.12 招待画面

`src/app/invites/[token]/page.tsx`

- 招待トークン確認
- ログイン誘導
- 招待受諾後のプロジェクト参加
- 現在のプロジェクト詳細 UI では、メール入力招待ではなく登録済みユーザー選択でメンバー追加する
- 招待 API / 画面はレガシー互換として残っている

## 6. 認証と権限制御

### 6.1 セッション

`src/lib/auth.ts`

- `createSession(userId)` で JWT を発行
- Cookie 名は `session`
- `getSession()` で Cookie を検証し、現在ユーザーを返す
- `requireSession()` は未認証時に例外を投げる

### 6.2 権限モデル

- 権限は `システムロール` と `プロジェクトロール` の2段構成
- システムロール
  - ユーザーに直接付与する
  - ユーザー管理、システムロール管理、プロジェクトロール管理、全プロジェクト表示/編集などを制御する
  - 定義は `system_role_definitions`
  - ユーザー側の付与状態は `users.system_role`
- プロジェクトロール
  - プロジェクトメンバーに付与する
  - プロジェクト内の表示、編集、項目表示/編集、生成、ノート、メンバー管理などを制御する
  - 定義は `project_role_definitions`
  - 付与状態は `project_members.role`
- プロジェクトオーナーは対象プロジェクトに対して強い権限を持つ
- `edit_all_projects` や `delete_any_project` などのシステム権限はプロジェクトロールを上書きできる
- 権限判定の共通処理は `src/lib/permissions.ts`

## 7. データモデル

型定義は `src/types/index.ts`、実体スキーマは `src/lib/db/index.ts` にあります。

### 7.1 users

- `id`
- `email`
- `password_hash`
- `name`
- `avatar_url`
- `system_role`
- `created_at`

### 7.2 organization_settings

- `id`
- `organization_id`
- `scope_key`
- `company_name`
- `company_description`
- `brand_voice`
- `brand_guidelines`
- `products`
- `objects`
- `project_types`
- `content_templates`
- `ai_settings`
- `updated_at`

補足:

- `scope_key = default` を現在の組織設定として扱う
- `objects` は Global Assets オブジェクト定義とレコードの JSON
- `project_types` はプロジェクト種別定義の JSON
- `content_templates` は生成コンテンツ定義の JSON
- `ai_settings` は AI 設定の JSON

### 7.3 global_assets

- `id`
- `user_id`
- `objects`
- `project_types`
- `content_templates`
- `ai_settings`
- `updated_at`

補足:

- レガシー移行元として残している
- 新規の設定参照先としては使わない

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

### 7.4 GlobalAssetObject

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
- `primary_assignee_id`
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
- `primary_assignee_id` はプロジェクト全体の代表担当者
- 主担当者はプロジェクトオーナーまたはプロジェクトメンバーから選択する

### 7.5 project_members

- `id`
- `project_id`
- `user_id`
- `role`
- `created_at`

補足:

- `role` は `project_role_definitions.key` を参照する
- 現在の UI では登録済みユーザーを選択して追加する

### 7.6 invitations

- `id`
- `project_id`
- `email`
- `token`
- `role`
- `status`
- `expires_at`
- `created_at`

補足:

- 招待機能はレガシー互換として残っている
- 現在のプロジェクト詳細 UI では登録済みユーザー選択によるメンバー追加を使う

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

### 7.9 system_role_definitions

- `id`
- `key`
- `name`
- `description`
- `permissions`
- `is_system`
- `sort_order`
- `created_at`
- `updated_at`

補足:

- `permissions` は JSON 文字列
- 初期ロール
  - `SYSTEM_ADMIN`: システム管理者
  - `MANAGER`: マネージャー
  - `USER`: 一般ユーザー
- 初回シード時、既存ユーザーの最初の1人を `SYSTEM_ADMIN` にする

### 7.10 project_role_definitions

- `id`
- `key`
- `name`
- `description`
- `permissions`
- `is_system`
- `sort_order`
- `created_at`
- `updated_at`

補足:

- `permissions` は JSON 文字列
- 初期ロール
  - `PROJECT_MANAGER`: プロジェクト管理者
  - `MEMBER`: メンバー
  - `GUEST`: ゲスト

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

- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users`
- `DELETE /api/users`
- `GET /api/roles`
- `PUT /api/roles`
- `GET /api/project-roles`
- `PUT /api/project-roles`
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
- `POST /api/projects/[id]/members`
- `PATCH /api/projects/[id]/members`
- `DELETE /api/projects/[id]/members`
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

### 11.1 Todo

目的:

- プロジェクトごとの実行管理
- 「誰が・何を・いつやるか」を明確にする

想定:

- 親子構造
- 担当者
- 開始日
- 締切日
- 優先度
- ステータス
- フェーズ紐付け
- Todo が KANBAN カードと WBS 行の元データになる

### 11.2 KANBAN

目的:

- Todo の進行状況を直感的に把握する

想定:

- プロジェクト内 KANBAN
  - 未着手 / 進行中 / 完了
  - ドラッグでステータス更新
  - 担当者、期日、優先度を表示
- 施策横断 KANBAN
  - プロジェクト単位のカード
  - フェーズまたはステータス軸

### 11.3 WBS

目的:

- Todo の日付から工程表を自動生成する

想定:

- X 軸は日付
- Y 軸は Todo
- 親子インデント
- start_date から due_date までをバー表示
- バー操作で日付編集し Todo に反映

### 11.4 レポート

目的:

- キャンペーン成果を再利用できる形で残す

想定:

- プロジェクトに1つのレポート
- KPI、背景、学び、インサイト
- PDF 出力 / 閲覧 URL 共有

### 11.5 プロジェクト ノート

目的:

- 打ち合わせメモ
- 意思決定の記録
- 補足情報の蓄積

想定:

- プロジェクト詳細内で管理
- 時系列または自由記述の運用を想定
- 打ち合わせ記録、判断理由、補足メモの蓄積先として使う

実装状況:

- 既にプロジェクト詳細の `ノート` タブとして実装済み

### 11.6 ダッシュボード強化

目的:

- 現在のダッシュボードはプロジェクト一覧と単純な統計のみで、運用者の「今日やるべきこと」が一目でわからない
- 自分のタスク状況とプロジェクト進捗を俯瞰できる起点画面にする

#### 11.6.1 画面構成

**サマリー行（4カード）**

- 総プロジェクト数
- アクティブ数
- 自分の未完了 Todo 数
- 期限超過 + 今日期限の Todo 数（1件以上でアンバー/レッドハイライト）

**2カラムレイアウト**

- 左 `flex-1`: プロジェクトカード一覧
  - フェーズ進捗バー（現在フェーズ位置 / 総フェーズ数）
  - Todo 未完了数バッジ（右下フッター）
- 右 `w-80 shrink-0`: サイドバーパネル
  - 「自分のタスク」セクション: 自分にアサインされた未完了 Todo（最大 8 件、期日順）
  - 「管理プロジェクトの急ぎタスク」セクション: 自分がオーナーのプロジェクトの全ユーザータスクのうち due_date ≤ 今日（最大 10 件、担当者名付き）

#### 11.6.2 API

**`GET /api/dashboard`**

サーバーサイドで以下を集約して1回のfetchで返す（N+1 防止）。

レスポンス:

```json
{
  "projects": [{ "...project fields": "...", "todo_total": 5, "todo_done": 2 }],
  "my_open_todos": [{ "id": "...", "project_id": "...", "project_name": "...", "title": "...", "status": "...", "priority": "...", "due_date": "..." }],
  "managed_urgent_todos": [{ "...todo fields": "...", "assignee_name": "...", "assignee_email": "..." }],
  "project_type_definitions": {},
  "stats": { "total": 10, "active": 4, "draft": 2, "my_todo_open": 7, "my_todo_urgent": 3 }
}
```

- `my_open_todos`: 自分が `assignee_id`、`status != done`、最大 8 件（期日 ASC）
- `managed_urgent_todos`: 自分がオーナーのプロジェクト内、`due_date <= 今日`、最大 10 件

実装状況: 実装済み（`src/app/api/dashboard/route.ts`、`src/app/page.tsx`）

### 11.7 My Todos ページ（全プロジェクト横断タスク一覧）

**ページ**: `/my-todos`（`src/app/my-todos/page.tsx`）

**API**: `GET /api/my-todos`（`src/app/api/my-todos/route.ts`）
  - クエリパラメータ: `status`, `priority`, `project_id`
  - レスポンス: `{ todos: MyTodo[], projects: {id, name}[] }`

**機能**:

- 全プロジェクト横断で自分にアサインされたタスクを一覧表示
- フィルター: ステータス（複数選択）・優先度（複数選択）・プロジェクト（セレクト）
- グループ表示切替: 期日順（期限切れ / 本日期限 / 今後 / 期日なし）またはプロジェクト別
- ナビゲーション: サイドバーに「自分のタスク」リンク追加

### 11.8 タスク管理 UX 強化（TodoTab）

`src/components/TodoTab.tsx` に以下の機能を追加・改修済み。

#### ダブルクリックで詳細モーダルを開く

- リストビュー: 行をダブルクリック
- カンバンビュー: カードをダブルクリック（ドラッグとの競合は `draggedRef` フラグで回避）
- ガントビュー: ラベル列またはバーをダブルクリック

`TodoDetailModal`: インライン編集（タイトル・ステータス・優先度・期日・担当者・説明）、サブタスク一覧、削除確認付き。

#### フィルターバー（全ビュー共通）

- 「完了を隠す」クイックトグル
- ステータス・優先度: マルチセレクトチップ
- 担当者: ドロップダウン
- クリアボタン（フィルタ適用中のみ表示）
- フィルタ済み件数をヘッダーに表示

#### ガントチャート機能強化

**日付ヘッダー 2 段表示**

- 上段: 月（`YYYY/M`）
- 下段: 日番号（週末はグレー表示）

**バー色分け（ステータス別）**

- 未着手: `#94a3b8`（slate）
- 進行中: `#3b82f6`（blue）
- 完了: `#10b981`（emerald）

**ドラッグ操作**

- バー中央ドラッグ: 開始日・期日を同日数シフト
- バー右端ドラッグ: 期日のみ変更
- ドラッグ中に日付プレビューテキストを表示

**担当者名表示**: タスク名の下段に表示（ガントラベル列）

**スケール切替**（ガントヘッダーのボタンで切替）

| スケール | 1格子の幅 | ティック |
|---|---|---|
| 1日 | 40px/日 | 全日、週末グレー |
| 週5日 | 平日22px・週末5px | 平日のみ日付ラベル（週末を折りたたみ表示） |
| 1週間 | 84px/週 | 月曜日の月/日ラベル |

**タスク名列スティッキー（横スクロール固定）**

- 左: 固定ラベル列 SVG（幅 220px）
- 右: 横スクロール可能なバー列 SVG（`overflow-x-auto`）
- フッター（凡例・操作Tips）はスクロールコンテナの外に配置

**拡大表示モード**

- スケール切替ボタンの横に「⛶ 拡大」ボタン
- クリックで `fixed inset-0 z-50` のフルスクリーンオーバーレイを表示
- 構成:
  - 左サイドバー（幅 208px）: スケール切替・完了を隠す・ステータス・優先度・担当者フィルター
  - 右メインエリア（`flex-1`）: ガントチャート（縦横スクロール対応）
- フィルター・スケール状態は通常ビューと共有

### 11.9 残っている主な作業

- レポート機能
- 権限の細粒度化
  - 現状は主にプロジェクト単位・項目単位・ノート単位・生成単位
  - 将来的に個別フィールドやセクション単位の制御が必要なら追加する
- 招待機能の扱い整理
  - 現在はレガシー互換で残している
  - 登録済みユーザー選択方式に一本化するなら削除または非表示化する

## 12. 実装上の注意

- `channels`、`options`、`warnings` は JSON 文字列で保存される
- `group` / `group_list` の `value` も JSON 文字列で保持する
- 招待 URL はレガシー招待機能でのみ `NEXT_PUBLIC_BASE_URL` に依存する
- `JWT_SECRET` は本番では必ず明示設定する
- AI 設定は組織単位で保存する
- システムロールとプロジェクトロールの初期データは `src/lib/permissions.ts` で定義し、DB 初期化時にシードする
### 7.1.5 organizations

- `id`
- `name`
- `slug`
- `status`
- `created_at`
- `updated_at`

補足:

- 現在は単一組織前提で 1 レコードを持つ
- `users.organization_id` と `projects.organization_id` と `organization_settings.organization_id` の親になる
