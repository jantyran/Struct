# Struct アーキテクチャメモ

## 1. 概要

Struct は、チームのプロジェクト・施策を構造化して管理するセルフホスト型ツールです。  
プロジェクトの進行、タスク管理、ノート、マスターデータ、AI 連携を組織単位またはプロジェクト単位で扱います。

アプリは次の 3 系統の情報を扱います。

- 組織単位の設定とマスターデータ
  - マスターデータ
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
  - Next.js 15 App Router
- 言語
  - TypeScript
- UI
  - React 18
  - Tailwind CSS
- 永続化
  - SQLite (`better-sqlite3`, WAL モード)
- 認証
  - JWT (`jose`, `httpOnly` Cookie)
  - パスワードハッシュ (`bcryptjs`)
- 暗号化
  - Node.js `crypto` (AES-256-GCM, 機密 API キーの暗号化保存)
- テスト
  - Vitest
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
  - セッション署名用秘密鍵（必須）
- `APP_ENCRYPTION_KEY`
  - AI API キー等の暗号化保存用キー（未設定時は `JWT_SECRET` から SHA-256 派生）
- `NEXT_PUBLIC_BASE_URL`
  - 招待 URL や外部公開リンク生成に使用
- `NEXT_PUBLIC_BASE_PATH`
  - 既定は空。サブパス配備時のみ使用（例: `/struct`）
- `ALLOW_PUBLIC_SIGNUP`
  - `true` のときだけ `/api/auth/signup` を有効化（既定は `false`）
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
  - パスワードリセットや通知メール配信用 SMTP 設定（未設定時はメール機能無効）

補足:

- AI API キーとモデル設定は `.env` ではなく `設定 > AI設定` に保存され、DB 上には AES-256-GCM で暗号化されて保持される
- `JWT_SECRET` は本番では必ず十分長いランダム文字列を設定する

## 3.1 起動・運用ポリシー

- `3002` 以降
  - 開発確認用ポート（3002 が使用中なら 3003, 3004...）
  - `npm run dev` で起動
  - コード変更をビルドなしで即時反映して確認する
- `38427`
  - 本番確認用ポート
  - `npm run build && npm run start` で起動
  - ビルド済み成果物で安定動作を確認する
- テスト実行
  - `npm test`（Vitest ユニットテストスイートを実行）
- バックアップ実行
  - `node scripts/backup.mjs`
  - SQLite の `VACUUM INTO` を使い、WAL モード下でも整合性を保ったままオンラインバックアップを生成

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
│   ├── struct.db
│   └── backups/
├── scripts/
│   ├── backup.mjs
│   └── dev.mjs
└── src/
    ├── app/
    │   ├── about/page.tsx
    │   ├── guide/page.tsx
    │   ├── layout.tsx
    │   ├── login/page.tsx
    │   ├── signup/page.tsx
    │   ├── page.tsx                       # メインダッシュボード
    │   ├── my-todos/page.tsx               # 全プロジェクト横断タスク
    │   ├── teams/page.tsx                  # チーム別進捗ダッシュボード
    │   ├── master-data/
    │   ├── project-types/page.tsx
    │   ├── projects/[id]/page.tsx          # プロジェクト詳細
    │   ├── settings/
    │   │   ├── page.tsx
    │   │   ├── ai/page.tsx
    │   │   ├── content-templates/page.tsx
    │   │   ├── organization/page.tsx
    │   │   ├── project-roles/page.tsx
    │   │   ├── roles/page.tsx
    │   │   ├── teams/page.tsx              # チーム管理設定
    │   │   └── users/page.tsx
    │   └── api/
    │       ├── ai-settings/route.ts
    │       ├── auth/
    │       ├── dashboard/route.ts
    │       ├── my-todos/route.ts
    │       ├── teams/                      # チーム管理 API
    │       │   ├── route.ts
    │       │   └── [teamId]/
    │       │       ├── route.ts
    │       │       └── members/
    │       ├── projects/
    │       │   ├── route.ts
    │       │   └── [id]/
    │       │       ├── todos/
    │       │       ├── relations/
    │       │       ├── members/
    │       │       └── ...
    │       └── users/route.ts
    ├── components/
    │   ├── GanttView.tsx
    │   ├── ProjectRelationsWidget.tsx
    │   ├── ProjectStructureTab.tsx
    │   ├── TabSettingsModal.tsx
    │   └── TodoTab.tsx
    ├── lib/
    │   ├── ai/
    │   ├── auth.ts
    │   ├── crawler.ts
    │   ├── db/index.ts
    │   ├── encryption.ts                  # AES-256-GCM 暗号化
    │   └── permissions.ts                 # システム・プロジェクト・チーム権限判定
    └── types/index.ts
```

## 5. 画面構成

### 5.1 共通レイアウト

`src/app/layout.tsx`

- 左サイドバー上部に主要ナビ
- 下部に `設定`、メールアドレス、ログアウトを配置
- タイトル表記は `Struct`
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

### 5.5 マスターデータ 一覧

`src/app/master-data/page.tsx`

- オブジェクト一覧と追加
- 各オブジェクト詳細への導線

### 5.6 マスターデータ 詳細

`src/app/master-data/[objectId]/page.tsx`

- オブジェクト設定
- 項目設定
- レコード一覧と編集
- `参照` / `複数参照` による他オブジェクト参照

### 5.7 設定ハブ

`src/app/settings/page.tsx`

- AI 設定
- 生成コンテンツ設定
- プロジェクト設定
- チーム管理（`/settings/teams`）
- ユーザー管理
- システムロール設定
- プロジェクトロール設定
- ショートカット設定
- 組織基本情報設定

### 5.8 AI 設定

`src/app/settings/ai/page.tsx`

- プロバイダ選択
- モデル入力
- Base URL 入力
- API キー入力（保存時に AES-256-GCM 暗号化）

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

- 基本情報編集（名称、種別、期間、公開範囲 `public` / `team` / `private`、所属チーム `team_id`）
- フェーズ Path UI
- タブバー DnD 並び替え
  - タブヘッダーを直接ドラッグ&ドロップして並び替え
  - 「タブ設定」モーダル（`TabSettingsModal.tsx`）による並び替え・表示/非表示切り替え
  - 並び順・表示設定はユーザーごとに `localStorage` に即時保存
- メンバータブ
  - 主担当者の変更
  - 登録済みユーザーからプロジェクトメンバーを追加
  - プロジェクトロールの付与・変更
- プロジェクト構造・関係タブ
  - 親プロジェクト・子プロジェクトの階層表示（`ProjectStructureTab.tsx`）
  - 依存・ブロック・関連施策のリンク（`ProjectRelationsWidget.tsx`）
- 設定由来フィールドの値入力
- マスターデータ 参照
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

### 5.13 チーム別進捗ダッシュボード

`src/app/teams/page.tsx`

- 所属チーム（または管理可能なチーム）の進捗状況を俯瞰
- チーム選択ドロップダウン
- サマリー統計: チーム所属プロジェクト数、未完了タスク数、遅延タスク数
- メンバー別タスク進捗カード: 各メンバーの総タスク数、完了数、遅延タスク数、進捗率プログレスバー
- チーム関連プロジェクト一覧: フェーズ進行状況、主担当者、未完了タスク数

### 5.14 チーム管理

`src/app/settings/teams/page.tsx`

- `manage_teams` 権限ユーザーまたはチームリーダー（`LEADER`）が利用可能
- チーム一覧表示・新規チーム作成モーダル
- チーム基本情報（チーム名、説明、カラーテーマ）の編集・チーム削除
- チームメンバー管理:
  - 組織内の登録済みユーザーからメンバーを追加
  - メンバーのロール（`LEADER` / `MEMBER`）の切り替え
  - メンバーの除外（最後のリーダーは保護）

### 5.15 全プロジェクト横断タスク一覧（My Todos）

`src/app/my-todos/page.tsx`

- 全プロジェクト横断で自分にアサインされたタスクを一覧表示
- フィルター: ステータス、優先度、プロジェクト
- 期日別 / プロジェクト別のグループ切り替え
- インラインでのステータス更新・期日確認

## 6. 認証と権限制御

### 6.1 セッション

`src/lib/auth.ts`

- `createSession(userId)` で JWT を発行
- Cookie 名は `session`
- `getSession()` で Cookie を検証し、現在ユーザーを返す
- `requireSession()` は未認証時に例外を投げる
- 公開 signup は `ALLOW_PUBLIC_SIGNUP=true` のときだけ有効

### 6.2 権限モデル

- 権限は `システムロール`、`チームロール`、`プロジェクトロール` の構成
- システムロール
  - ユーザーに直接付与する
  - ユーザー管理、チーム管理、システムロール管理、プロジェクトロール管理、全プロジェクト表示/編集などを制御する
  - 定義は `system_role_definitions`
  - ユーザー側の付与状態は `users.system_role`
  - システム権限キー一覧:
    - `manage_organization_settings`: 組織基本設定の変更
    - `manage_users`: ユーザーの追加・編集・削除
    - `manage_teams`: チームの作成・編集・削除・全チーム管理
    - `manage_system_roles`: システムロールの定義・ユーザーへの付与
    - `manage_project_roles`: プロジェクトロール定義の編集
    - `manage_project_settings`: プロジェクト種別・フェーズ・項目の編集
    - `manage_master_data`: マスターデータオブジェクト・項目の編集
    - `manage_ai_settings`: AI プロバイダ・API キー設定の編集
    - `view_all_projects`: 公開範囲や参加有無に関わらず全プロジェクトの閲覧
    - `edit_all_projects`: 全プロジェクトの編集
    - `delete_any_project`: 全プロジェクトの削除
- チームロール
  - チームメンバーに付与する（`team_members.role`）
  - ロール種別:
    - `LEADER`: チーム情報の変更、チームメンバーの追加・削除・ロール変更が可能
    - `MEMBER`: チーム所属メンバー（チーム限定プロジェクトへのアクセス権を保持）
  - システム権限 `manage_teams` を持つユーザーは、所属に関わらず全チームのリーダー権限と同等の操作が可能
- プロジェクトロール
  - プロジェクトメンバーに付与する
  - プロジェクト内の表示、編集、項目表示/編集、生成、ノート、メンバー管理などを制御する
  - 定義は `project_role_definitions`
  - 付与状態は `project_members.role`
- プロジェクト公開範囲（`visibility`）と可視性
  - `public`: 組織内の全ユーザーが閲覧可能
  - `team`: プロジェクトの `team_id` に属するチームメンバー、およびプロジェクト参加者が閲覧可能
  - `private`: プロジェクトオーナーおよび明示的に追加されたプロジェクトメンバーのみ閲覧可能
  - ※ システム権限 `view_all_projects` を持つユーザーは `visibility` に関わらず組織内の全プロジェクトを閲覧可能
- プロジェクトオーナーは対象プロジェクトに対して強い権限を持つ
- `edit_all_projects` や `delete_any_project` などのシステム権限はプロジェクトロールを上書きできる
- 権限判定の共通処理は `src/lib/permissions.ts`
- プロジェクト API は原則として `requireProjectPermission()` を通して権限判定する
- 個別リソース更新では `id` と `project_id` の両方で対象を絞る
- `manage_users` と `manage_system_roles` は分離する
  - ユーザー作成・削除・プロフィール編集は `manage_users`
  - システムロール付与・変更は `manage_system_roles`
  - 自分自身のシステムロール変更は禁止

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

- `scope_key` は `org-settings:${organization_id}` 形式で保持する
- 旧 `scope_key = default` の行は DB 初期化時に現行形式へ移行する
- `objects` は マスターデータ オブジェクト定義とレコードの JSON
- `project_types` はプロジェクト種別定義の JSON
- `content_templates` は生成コンテンツ定義の JSON
- `ai_settings` は AI 設定の JSON
- `shortcut_settings` は組織共通ショートカット設定の JSON

### 7.3 organizations

- `id`
- `name`
- `slug`
- `status`
- `created_at`
- `updated_at`

補足:

- 現在は単一組織前提で 1 レコードを持つ
- `users.organization_id`、`projects.organization_id`、`organization_settings.organization_id` の親になる

### 7.4 global_assets

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

### 7.5 GlobalAssetObject

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

### 7.6 projects

- `id`
- `name`
- `type`
- `phase_key`
- `status`
- `owner_id`
- `organization_id`
- `primary_assignee_id`
- `parent_project_id`
- `visibility`
- `team_id`
- `cloned_from`
- `target`
- `start_date`
- `end_date`
- `budget`
- `channels`
- `description`
- `completed_at`
- `completed_by`
- `is_onboarding`
- `created_at`
- `updated_at`

補足:

- `channels` は JSON 文字列で保存
- `phase_key` は現在フェーズを表す
- `primary_assignee_id` はプロジェクト全体の代表担当者
- `parent_project_id` は親プロジェクト ID（階層管理用）
- `visibility` は公開範囲（`public`: 全体公開, `team`: チーム限定, `private`: 非公開）
- `team_id` は所属チーム ID（`teams.id` への外部キー）
- 主担当者はプロジェクトオーナーまたはプロジェクトメンバーから選択する

### 7.7 project_members

- `id`
- `project_id`
- `user_id`
- `role`
- `created_at`

補足:

- `role` は `project_role_definitions.key` を参照する
- 現在の UI では登録済みユーザーを選択して追加する

### 7.8 project_contacts

- `id`
- `project_id`
- `name`
- `email`
- `phone`
- `company_name`
- `created_at`
- `updated_at`

補足:

- プロジェクトメンバーとは別に持つ外部連絡先メモ
- `name` のみ必須
- 現在の UI ではプロジェクト詳細の `メンバー` タブから編集する

### 7.9 invitations

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

### 7.10 custom_fields

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

- `type` は `text | textarea | url | date | number | select | reference | reference_multi | group | group_list | list`
- `layout` は `half | full`
- `options` は型ごとの設定 JSON
- `group` / `group_list` は子項目定義を `options.children` に持つ
- `group` / `group_list` の値は `value` に JSON 文字列で保存する

### 7.11 generated_assets

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

### 7.12 system_role_definitions

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

### 7.13 project_role_definitions

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

### 7.14 teams

- `id`
- `organization_id`
- `name`
- `description`
- `created_at`
- `updated_at`

補足:

- 組織（`organizations`）配下の部署・チームグループ
- `teams.id` は `projects.team_id` および `team_members.team_id` から参照される

### 7.15 team_members

- `id`
- `team_id`
- `user_id`
- `role` (`LEADER` | `MEMBER`)
- `created_at`

補足:

- `(team_id, user_id)` のユニーク制約
- `LEADER` はチーム情報の編集やメンバー追加・除外が可能

### 7.16 project_relations

- `id`
- `project_a_id`
- `project_b_id`
- `relation_type` (`related` | `depends_on` | `blocks`)
- `note`
- `created_at`
- `updated_at`

補足:

- 任意のプロジェクト間の相互関連・依存関係を管理

### 7.17 todos

- `id`
- `project_id`
- `title`
- `description`
- `assignee_id`
- `status` (`todo` | `in_progress` | `done`)
- `priority` (`low` | `medium` | `high` | `urgent`)
- `phase_key`
- `parent_id`
- `tags`
- `start_date`
- `due_date`
- `sort_order`
- `completed_at`
- `completed_by`
- `created_at`
- `updated_at`

補足:

- `parent_id` によるサブタスク（親子構造）対応
- `tags` は JSON 文字列で保存

### 7.18 project_notes

- `id`
- `project_id`
- `title`
- `content`
- `pinned`
- `created_at`
- `updated_at`

補足:

- Markdown / Milkdown リッチテキストでノートを保持
- `pinned = 1` のノートは上部に固定表示

### 7.19 project_sheets

- `id`
- `project_id`
- `title`
- `data`
- `created_at`
- `updated_at`

## 8. 設計方針

### 8.1 マスターデータ とプロジェクト項目の役割分担

- 再利用・横断管理したいもの
  - マスターデータ のオブジェクトで管理
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

### 8.4 プロジェクトクローン

- プロジェクトクローンは、同種プロジェクトの再実施に使えるテンプレート化を主目的にする
- クローン時は、フィールド定義に加えて Todo / サブタスク、シート、関係者、ノートを選択して複製できる
- `再実施用テンプレート` では入力値、Todo の担当者・日付・完了状態、シート行データ、ノート本文をリセットする
- `入力値も含める` ではフィールド値、Todo 状態、担当者、日付、シート行データ、ノート本文も引き継ぐ
- メンバー、招待、生成コンテンツは現時点ではクローン対象にしない

## 9. API 構成

### 9.1 認証

- `POST /api/auth/signup`
  - `ALLOW_PUBLIC_SIGNUP=true` のときだけ有効
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
- `GET /api/master-data`
- `PUT /api/master-data`
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
- `POST /api/projects/[id]/contacts`
- `PATCH /api/projects/[id]/contacts`
- `DELETE /api/projects/[id]/contacts`
- `GET /api/projects/[id]/todos`
- `POST /api/projects/[id]/todos`
- `PUT /api/projects/[id]/todos/[todoId]`
- `DELETE /api/projects/[id]/todos/[todoId]`
- `GET /api/projects/[id]/notes`
- `POST /api/projects/[id]/notes`
- `PUT /api/projects/[id]/notes/[noteId]`
- `DELETE /api/projects/[id]/notes/[noteId]`
- `GET /api/projects/[id]/relations`
- `POST /api/projects/[id]/relations`
- `DELETE /api/projects/[id]/relations/[relationId]`
- `GET /api/projects/[id]/children`
- `PUT /api/projects/[id]/relations/parent`
- `GET /api/projects/[id]/sheets`
- `POST /api/projects/[id]/sheets`
- `PUT /api/projects/[id]/sheets/[sheetId]`
- `DELETE /api/projects/[id]/sheets/[sheetId]`
- `POST /api/projects/[id]/invite`

### 9.4 チーム管理

- `GET /api/teams`
- `POST /api/teams`
- `GET /api/teams/[teamId]`
- `PUT /api/teams/[teamId]`
- `DELETE /api/teams/[teamId]`
- `GET /api/teams/[teamId]/members`
- `POST /api/teams/[teamId]/members`
- `PUT /api/teams/[teamId]/members/[userId]`
- `DELETE /api/teams/[teamId]/members/[userId]`

### 9.5 ダッシュボード・横断機能

- `GET /api/dashboard`
- `GET /api/my-todos`
- `GET /api/my-report`
- `GET /api/search`

### 9.6 招待

- `GET /api/invites/[token]`
- `POST /api/invites/[token]/accept`

## 10. AI フロー

### 10.1 参照情報の組み立て

`src/lib/ai/prompt-builder.ts`

AI には次の情報を渡します。

- マスターデータ
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

## 11. 実装済み機能の記録

### 11.1 Todo / KANBAN / ガント（WBS）

実装状況: **実装済み**（`src/components/TodoTab.tsx`、`src/app/api/projects/[id]/todos/`）

実装内容:

- プロジェクト詳細の `Todo` タブとして統合
- リスト / カンバン / ガント の3ビューを切り替え可能（ユーザー設定でデフォルトビューを保存）
- 親子タスク構造
- 担当者・開始日・締切日・優先度・ステータス・フェーズ紐付け
- ダブルクリックで詳細モーダル（インライン編集・サブタスク・削除確認）
- フィルターバー（完了を隠す・ステータス・優先度・担当者、全ビュー共通）
- カンバン: ドラッグ&ドロップでステータス更新
- ガント:
  - 日付ヘッダー2段（月 / 日）、週末グレー
  - バー色分け（ステータス別）
  - バーのドラッグで日程編集（中央: 全体シフト、右端: 期日のみ）
  - スケール切替（1日 / 週5日 / 1週間）
  - タスク名列スティッキー固定
  - 拡大表示モード（フルスクリーンオーバーレイ）

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

### 11.10 プロジェクト階層 & 関連プロジェクト

実装状況: **実装済み**（`src/components/ProjectStructureTab.tsx`、`src/components/ProjectRelationsWidget.tsx`、`src/app/api/projects/[id]/relations/`）

- 親プロジェクト指定によるプロジェクト階層化（`parent_project_id`）
- プロジェクト詳細の「構造」タブで子プロジェクト一覧や進捗をツリー表示
- 任意プロジェクト間の相互リンク管理（`depends_on`、`blocks`、`related`）
- 関連プロジェクトウィジェットによる直接リンク遷移

### 11.11 プロジェクトタブのドラッグ＆ドロップ並び替え

実装状況: **実装済み**（`src/app/projects/[id]/page.tsx`、`src/components/TabSettingsModal.tsx`）

- プロジェクト詳細上部のメインタブバーで、タブを直接ドラッグ＆ドロップして並び替え可能
- タブバー右端の「タブ設定」歯車アイコンから `TabSettingsModal` を開き、ドラッグ並び替えおよびタブの表示/非表示切り替えが可能
- タブの順序と表示/非表示設定はユーザー・プロジェクトごとに `localStorage` に即時保存され、次回以降のアクセスでも維持される

### 11.12 チーム制 & チーム別進捗ダッシュボード

実装状況: **実装済み**（`src/app/teams/page.tsx`、`src/app/settings/teams/page.tsx`、`src/app/api/teams/`）

- 組織内でのチーム（部署・グループ）作成・編集・削除
- チームメンバー管理（追加、除外、`LEADER` / `MEMBER` ロール切り替え）
- システム権限 `manage_teams` によるシステムロール連動のチーム管理アクセス制御
- チーム別進捗ダッシュボード（`/teams`）:
  - チーム全体のタスク進捗率、期限超過タスク件数、未完了タスク件数
  - チームメンバー別の担当タスク消化状況カード
  - チーム所属プロジェクト一覧とフェーズ進行状況
- プロジェクト公開範囲（`visibility`: `public` / `team` / `private`）とチーム連動

### 11.13 機密データ暗号化 & テスト基盤 & オンラインバックアップ

実装状況: **実装済み**（`src/lib/encryption.ts`、`scripts/backup.mjs`、`*.test.ts`）

- **AI APIキー暗号化**: Node.js 標準 `crypto` の **AES-256-GCM** を使用し、組織設定保存時に API キーを自動暗号化（`enc:v1:...`）。環境変数 `APP_ENCRYPTION_KEY` または `JWT_SECRET` より鍵を導出。
- **テスト自動化**: `vitest` によるユニットテストスイート（`npm test`）。権限判定、暗号化/復号、SSRF対策クローラーの検証を自動化。
- **オンライン安全バックアップ**: SQLite の `VACUUM INTO` コマンドを使用したバックアップスクリプト（`node scripts/backup.mjs`）。WAL モード下でもロック競合や不整合を起こさず即座にバックアップファイルを生成。

### 11.14 残っている主な作業

- レポート機能
  - キャンペーン成果や施策結果のレポーティング、PDF出力
- 権限の細粒度化
  - 個別フィールドやセクション単位の閲覧/編集権限制御が必要になった場合の拡張
- 招待機能の扱い整理
  - 現在はレガシー互換で残している
  - 登録済みユーザー選択方式に一本化するなら削除または非表示化する

## 12. 実装上の注意

- `channels`、`options`、`warnings` は JSON 文字列で保存される
- `group` / `group_list` の `value` も JSON 文字列で保持する
- AI 設定の API キーは保存時に `encryptString`（AES-256-GCM）で暗号化され、AI 呼び出し時に `decryptString` で復号される（平文保存禁止）
- プロジェクトタブの順序と表示設定はブラウザの `localStorage` に保持される
- DB バックアップは WAL モード下でのファイル直接コピーを避け、`scripts/backup.mjs`（`VACUUM INTO`）を使用する
- 招待 URL はレガシー招待機能でのみ `NEXT_PUBLIC_BASE_URL` に依存する
- `JWT_SECRET` は本番では必ず明示設定する
- 公開 signup を許可する場合だけ `ALLOW_PUBLIC_SIGNUP=true` にする
- AI 設定は組織単位で保存する
- システムロールとプロジェクトロールの初期データは `src/lib/permissions.ts` で定義し、DB 初期化時にシードする
- URL crawl は `src/lib/crawler.ts` で外部 URL として検証する
  - private / loopback / link-local などの IP は DNS 解決後にも拒否する
  - リダイレクト先も同じ検証を通す
  - HTML / XHTML / plain text 以外は拒否する
