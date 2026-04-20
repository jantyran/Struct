# 組織レベル設定リファクタリング

## 目的

Struct の設定を「ユーザーごとの設定」ではなく「組織アカウント全体の設定」として扱う。

対象:

- AI 設定
- 生成コンテンツ設定
- プロジェクト設定
- Global Assets
- それらを参照する生成・補完・プロジェクト作成処理

非対象:

- ユーザープロフィール
- システムロール付与
- プロジェクトメンバー / プロジェクトロール

## 現状の問題

- `global_assets` が `user_id` 単位で保存されている
- 設定 UI はログインユーザーの `global_assets` を更新している
- プロジェクト生成は `owner_id` の `global_assets` を参照している
- AI 補完は実行ユーザーの `global_assets` を参照している
- 同じ組織内でも、誰が保存したか・誰が実行したかで参照設定がぶれる

## 方針

単一組織運用を前提に、設定の正本を `organization_settings` テーブルへ移す。

- `organization_settings.scope_key = 'default'` を現時点の唯一の組織設定として扱う
- 既存 `global_assets` はレガシー移行元として残す
- 参照系 / 更新系 API はすべて `organization_settings` を使う
- システムロールは「設定を変更できるか」を制御し、設定データの所有者にはしない

## データ設計

新規テーブル:

- `organization_settings`
  - `id`
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

移行:

- 既存 `organization_settings` がなければ作成
- 移行元は以下の優先順で 1 件選ぶ
  1. システム管理者に紐づく `global_assets`
  2. それ以外の最新 `global_assets`
  3. 何もなければ空の初期値

## API 設計

以下はすべて組織設定を読む:

- `/api/global-assets`
- `/api/project-types`
- `/api/content-templates`
- `/api/ai-settings`
- `/api/projects`
- `/api/projects/[id]`
- `/api/projects/[id]/generate`
- `/api/projects/[id]/complete`

更新権限:

- Global Assets: `manage_global_assets`
- AI 設定: `manage_ai_settings`
- プロジェクト設定 / 生成コンテンツ設定: `manage_project_settings`

## 実装ステップ

1. `organization_settings` テーブル追加
2. 起動時マイグレーションでレガシーデータを 1 件移行
3. 組織設定取得ヘルパー追加
4. 設定 API を組織設定参照へ切替
5. プロジェクト作成・詳細・生成・補完を組織設定参照へ統一
6. ユーザー作成 / signup 時の `global_assets` 自動作成を廃止
7. ドキュメント更新

## 変更後に期待する状態

- 設定は誰がログインしても同じ内容を参照する
- 変更可否だけがシステムロールで制御される
- AI 生成 / AI 補完 / プロジェクト作成の参照設定が一致する
- 今後の「AI 参照ポリシー」も組織設定として拡張できる

## 残タスク

- `global_assets` の完全廃止とスキーマ整理
- 将来の複数組織対応時に `scope_key` を実組織 ID に置換
- AI 参照範囲ポリシーを `project_types` / `content_templates` に統合
