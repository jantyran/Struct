# 組織モデル明示化リファクタリング

## 背景

`organization_settings` の導入により、設定の正本はユーザー単位から組織単位へ移った。  
ただし現状は「組織設定」は存在する一方で、「組織そのもの」を表す親テーブルが存在しない。

そのため、概念上は組織レベルの設定を持ちながら、DB の親子関係としては以下が未整理である。

- ユーザーがどの組織に所属するか
- プロジェクトがどの組織に属するか
- ロール定義がどの組織に属するか
- 将来の複数組織対応時に、どこを境界にデータを分けるか

## このリファクタリングの目的

Struct のデータモデルを、`organization` を親に持つ形へ整理する。

目標:

- `organization` を最上位の業務境界として明示する
- `users` と `projects` と `organization_settings` を同一組織配下に揃える
- 将来の複数組織対応を見据えた拡張点を先に整える
- 権限判定を「誰か」ではなく「どの組織の中で何ができるか」で考えやすくする

非目標:

- 今回の段階で完全なマルチテナント SaaS 化までは行わない
- 組織切り替え UI や請求管理までは作らない
- 監査ログやSSO連携までは含めない

## 現状の問題

現在のモデルは以下の状態で、`organization` の実体がない。

- `organization_settings`
  - 組織レベルの設定正本
- `users`
  - 個別ユーザー
- `projects`
  - プロジェクト

この結果、以下が曖昧になっている。

- あるユーザーがどの組織の人かを DB で明示できない
- あるプロジェクトがどの組織のものかを `owner_id` 以外で表現できない
- ロール定義がグローバルなのか組織単位なのかが将来的に不明瞭
- 招待や共有の境界が組織単位で整理されていない

## 要件

### 1. 組織を親エンティティとして追加

新規テーブル:

- `organizations`
  - `id`
  - `name`
  - `slug`
  - `status`
  - `created_at`
  - `updated_at`

役割:

- Struct における最上位の業務境界
- 設定、ユーザー、プロジェクト、ロール定義の所属先

### 2. 組織設定を組織に直接紐づける

現状:

- `organization_settings.scope_key = 'default'`

変更後:

- `organization_settings.organization_id`

備考:

- `scope_key` はレガシー互換のため一時的に残してもよい
- 最終的には `organization_id` を正本にする

### 3. ユーザーと組織の所属関係を明示する

選択肢は 2 つある。

#### A. 単純案

- `users.organization_id` を追加

利点:

- 実装が軽い
- 現在の単一組織前提に最も近い

欠点:

- 1 ユーザー複数組織所属に拡張しにくい

#### B. 推奨案

新規テーブル:

- `organization_memberships`
  - `id`
  - `organization_id`
  - `user_id`
  - `system_role`
  - `created_at`
  - `updated_at`

利点:

- 1 ユーザーが複数組織に所属できる
- システムロールを組織ごとに持てる
- 将来の組織切替に自然につながる

欠点:

- 現在の `users.system_role` 依存箇所を置き換える必要がある

今回の推奨:

- まずは `organization_memberships` を導入する前提で設計する
- 実装負荷が重ければ、第一段階のみ `users.organization_id` で進める

### 4. プロジェクトを組織に直接紐づける

`projects.organization_id` を追加する。

意味:

- プロジェクトの所属先は owner ではなく organization
- `owner_id` は「作成者 / 所有責任者」
- `organization_id` は「どの組織のプロジェクトか」

### 5. 組織配下の定義テーブルを整理する

現時点の候補:

- `organization_settings`
- `system_role_definitions`
- `project_role_definitions`

設計方針:

- 第一段階ではロール定義はグローバルのままでも可
- 第二段階で `organization_id` を持たせ、組織ごとのロール定義に拡張できるようにする

## 推奨DB設計

### 第一段階

```text
organizations
  ├ organization_settings
  ├ organization_memberships
  │  └ users
  ├ projects
  │  ├ custom_fields
  │  ├ generated_assets
  │  ├ project_notes
  │  ├ todos
  │  └ project_members
  ├ system_role_definitions
  └ project_role_definitions
```

### テーブル案

#### organizations

- `id TEXT PRIMARY KEY`
- `name TEXT NOT NULL`
- `slug TEXT UNIQUE NOT NULL`
- `status TEXT DEFAULT 'active'`
- `created_at`
- `updated_at`

#### organization_settings

- `id TEXT PRIMARY KEY`
- `organization_id TEXT UNIQUE NOT NULL`
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

#### organization_memberships

- `id TEXT PRIMARY KEY`
- `organization_id TEXT NOT NULL`
- `user_id TEXT NOT NULL`
- `system_role TEXT NOT NULL`
- `created_at`
- `updated_at`
- `UNIQUE (organization_id, user_id)`

#### users

- `id`
- `email`
- `password_hash`
- `name`
- `avatar_url`
- `created_at`

注記:

- `users.system_role` は段階的に廃止
- 権限判定は `organization_memberships.system_role` を見る

#### projects

- `id`
- `organization_id TEXT NOT NULL`
- `owner_id TEXT NOT NULL`
- `primary_assignee_id`
- その他既存カラム

## 関係性

### ユーザー

- `users` はアカウント本体
- `organization_memberships` が組織所属を表す
- システムロールは membership 側で管理する

### プロジェクト

- `projects.organization_id` が所属組織
- `project_members` はプロジェクト単位のメンバー
- `project_members.user_id` は `users.id`

### 設定

- `organization_settings.organization_id` が所属組織
- Global Assets / Project Types / Content Templates / AI Settings はこの組織に属する

## 移行方針

単一組織運用を前提とした段階移行にする。

### Phase 1

- `organizations` 追加
- 初期組織を 1 件作る
- `organization_settings` に `organization_id` を追加
- 既存 `default` 設定を初期組織に紐づける
- `projects.organization_id` を追加して既存プロジェクトを初期組織へ移行

### Phase 2

- `organization_memberships` 追加
- 既存 `users.system_role` を membership 側へコピー
- 権限判定を membership ベースへ置換

### Phase 3

- `users.system_role` 廃止
- `organization_settings.scope_key` 廃止
- ロール定義を必要に応じて組織別定義へ拡張

## API / 認可の変更点

### 認証

- セッションから `user.id` を得るだけでは不足
- アクティブな `organization_id` を解決する必要がある

将来案:

- セッションに `current_organization_id` を持つ
- 複数組織に所属する場合は UI で切替可能にする

### API

各 API は、設定やプロジェクトを読むときに必ず `organization_id` を通す。

例:

- `/api/project-types`
  - セッションの current organization を参照
- `/api/projects`
  - current organization の projects だけを返す
- `/api/projects/[id]`
  - `project.organization_id === current_organization_id` を確認

## UI への影響

今回のリファクタ自体では最小限でもよいが、将来以下が必要になる。

- 組織名の表示
- 組織設定の明示
- 必要に応じた組織切替 UI
- 組織へのメンバー招待

## 実装フェーズ案

### フェーズ 1: 親組織の導入

- `organizations`
- `organization_settings.organization_id`
- `projects.organization_id`
- 既存コードの組織境界対応

### フェーズ 2: ユーザー所属の導入

- `organization_memberships`
- 権限判定の置換
- ユーザー管理画面の変更

### フェーズ 3: 仕上げ

- レガシーカラム削除
- ドキュメント更新
- 複数組織対応準備

## 難所

- 現在の `users.system_role` 依存を membership ベースに置換する範囲が広い
- セッションに organization 文脈がないため、API 共通部の変更が必要
- `projects.owner_id` 前提のコードが多いと、`organization_id` 併用へ直す手間がある
- 既存データ移行で「初期組織に全件ぶら下げる」マイグレーションを慎重に書く必要がある

## 実装難易度の見積もり

### 最小構成

内容:

- `organizations`
- `organization_settings.organization_id`
- `projects.organization_id`
- 単一組織固定
- 権限は現状維持

難易度:

- 中

目安:

- 0.5 日から 1.5 日

### 推奨構成

内容:

- 上記に加えて `organization_memberships`
- 権限判定を membership ベースへ変更
- ユーザー管理とセッションの調整

難易度:

- 中から高

目安:

- 2 日から 4 日

### 将来拡張込み

内容:

- 複数組織切替
- 組織ごとのロール定義
- 招待フローの組織対応

難易度:

- 高

目安:

- 4 日から 8 日以上

## 推奨判断

次の実装としては、以下の順が安全。

1. `organizations` と `projects.organization_id` を入れる
2. `organization_settings.organization_id` に切り替える
3. その後 `organization_memberships` へ進む

これなら現在の機能を壊しにくく、段階移行しやすい。
