# Struct アーキテクチャメモ

## 1. 概要

Struct は、マーケティング施策に必要な情報を構造化し、AI 生成と再利用を支える Next.js アプリです。

アプリは次の 2 系統の情報を扱います。

- ユーザー単位の Global Assets
  - 会社情報
  - ブランドボイス
  - ブランドガイドライン
  - 製品 / サービス情報
- プロジェクト単位の情報
  - Project Core
  - Custom Fields
  - 生成済みアセット
  - メンバーと招待情報

プロジェクトはオーナーとメンバーで共有でき、蓄積済みのブランド情報と案件情報を AI に渡してマーケティング成果物を生成します。

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
  - Anthropic SDK
  - モデル: `claude-haiku-4-5-20251001`
- HTML 抽出
  - `cheerio`
- ID 生成
  - `uuid`

## 3. 環境変数

実装上、重要なのは以下です。

- `ANTHROPIC_API_KEY`
  - AI 生成と AI 補完に使用
- `JWT_SECRET`
  - セッション署名用
  - 未設定時はローカル向けの固定値へフォールバック
- `NEXT_PUBLIC_BASE_URL`
  - 招待 URL 生成に使用
  - 未設定時は `http://localhost:3002`

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
    │   ├── api/
    │   │   ├── auth/
    │   │   │   ├── login/route.ts
    │   │   │   ├── logout/route.ts
    │   │   │   ├── me/route.ts
    │   │   │   └── signup/route.ts
    │   │   ├── global-assets/route.ts
    │   │   ├── invites/[token]/
    │   │   │   ├── route.ts
    │   │   │   └── accept/route.ts
    │   │   └── projects/
    │   │       ├── route.ts
    │   │       └── [id]/
    │   │           ├── route.ts
    │   │           ├── assets/route.ts
    │   │           ├── clone/route.ts
    │   │           ├── complete/route.ts
    │   │           ├── crawl/route.ts
    │   │           ├── generate/route.ts
    │   │           └── invite/route.ts
    │   ├── global-assets/page.tsx
    │   ├── invites/[token]/page.tsx
    │   ├── login/page.tsx
    │   ├── signup/page.tsx
    │   ├── projects/[id]/page.tsx
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components/
    │   └── AuthContext.tsx
    ├── lib/
    │   ├── ai/
    │   │   ├── client.ts
    │   │   └── prompt-builder.ts
    │   ├── auth.ts
    │   ├── crawler.ts
    │   └── db/index.ts
    └── types/index.ts
```

## 5. 画面構成

### 5.1 共通レイアウト

`src/app/layout.tsx`

- 左サイドバーに `ダッシュボード` と `Global Assets`
- 未ログイン時はログイン、サインアップ画面以外で実質的にナビを出さない
- `AuthProvider` が全画面を包む

### 5.2 認証画面

- `src/app/login/page.tsx`
  - `/api/auth/login` を呼ぶ
- `src/app/signup/page.tsx`
  - `/api/auth/signup` を呼ぶ

### 5.3 ダッシュボード

`src/app/page.tsx`

- アクセス可能なプロジェクト一覧を表示
- 新規作成モーダル
- クローンモーダル
- ステータス / 種別フィルタ
- 総数、実施中、下書きの集計

### 5.4 Global Assets

`src/app/global-assets/page.tsx`

- 会社情報編集
- ブランドボイス編集
- ブランドガイドライン編集
- 製品 / サービスの追加、更新、削除
- 保存先は `/api/global-assets`

### 5.5 プロジェクト詳細

`src/app/projects/[id]/page.tsx`

- プロジェクト名、ステータス、基本情報の編集
- Custom Fields の追加、削除、更新
- URL 型フィールドのクロール
- AI 補完提案の取得と適用
- AI 生成対象の選択と生成実行
- 生成済みアセットの表示、コピー、削除
- 継承フィールドの警告表示

### 5.6 招待画面

`src/app/invites/[token]/page.tsx`

- 招待トークンの内容確認
- ログイン誘導
- 招待受諾後に対象プロジェクトへ遷移

## 6. 認証と権限制御

### 6.1 セッション

`src/lib/auth.ts`

- `createSession(userId)` で JWT を発行
- Cookie 名は `session`
- 有効期限は 5 日
- `getSession()` で Cookie を検証し、`users` テーブルから現在ユーザーを取得
- `requireSession()` は未認証時に例外を投げる

### 6.2 権限モデル

- プロジェクトには `owner_id` がある
- `project_members` に参加ユーザーを保持する
- 一覧取得、詳細取得、更新、AI 生成、クロール、アセット取得はオーナーまたはメンバーが可能
- 招待発行と削除はオーナーのみ可能

## 7. データモデル

型定義は `src/types/index.ts`、実体スキーマは `src/lib/db/index.ts` にあります。

### 7.1 users

- `id`
- `email`
- `password_hash`
- `name`
- `created_at`

### 7.2 projects

- `id`
- `name`
- `type`
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

- `channels` は配列ではなく JSON 文字列で保存される

### 7.3 project_members

- `id`
- `project_id`
- `user_id`
- `role`
- `created_at`

### 7.4 invitations

- `id`
- `project_id`
- `email`
- `token`
- `role`
- `status`
- `expires_at`
- `created_at`

### 7.5 global_assets

- `id`
- `user_id`
- `company_name`
- `company_description`
- `brand_voice`
- `brand_guidelines`
- `products`
- `updated_at`

補足:

- `products` は JSON 文字列で保存される
- 1 ユーザー 1 レコード前提

### 7.6 custom_fields

- `id`
- `project_id`
- `key`
- `label`
- `type`
- `value`
- `options`
- `inherited`
- `inherited_from`
- `crawled_content`
- `sort_order`

補足:

- `type` は `text | textarea | url | date | select`
- `options` は JSON 文字列
- 値付きクローン時は `inherited = 1`

### 7.7 generated_assets

- `id`
- `project_id`
- `asset_type`
- `title`
- `content`
- `warnings`
- `created_at`

補足:

- `warnings` は JSON 文字列
- `asset_type` は `lp | dm | sns_twitter | sns_linkedin | ad_copy | email | report`

## 8. 永続化

`src/lib/db/index.ts`

- DB ファイルは `data/struct.db`
- 初回アクセス時に DB 接続を初期化
- `journal_mode = WAL`
- `foreign_keys = ON`
- `CREATE TABLE IF NOT EXISTS` で起動時にスキーマを保証

この層は SQL 風 API のラッパーではなく、`better-sqlite3` を直接使う構成です。

## 9. API 構成

### 9.1 認証

- `POST /api/auth/signup`
  - ユーザー作成
  - パスワードをハッシュ化
  - セッションを作成
- `POST /api/auth/login`
  - 資格情報を検証してセッション作成
- `POST /api/auth/logout`
  - `session` Cookie を削除
- `GET /api/auth/me`
  - 現在ユーザーを返す

### 9.2 Global Assets

- `GET /api/global-assets`
  - 現在ユーザーの Global Assets を返す
- `PUT /api/global-assets`
  - 現在ユーザーの Global Assets を更新

### 9.3 プロジェクト

- `GET /api/projects`
  - オーナーまたはメンバーとして参照可能なプロジェクト一覧
- `POST /api/projects`
  - 新規作成
- `GET /api/projects/[id]`
  - プロジェクト本体、Custom Fields、Members、Pending Invitations を返す
- `PUT /api/projects/[id]`
  - 基本情報と Custom Fields をまとめて更新
- `DELETE /api/projects/[id]`
  - オーナーのみ削除可

### 9.4 補助 API

- `POST /api/projects/[id]/clone`
  - プロジェクト複製
- `POST /api/projects/[id]/crawl`
  - URL 型フィールドの本文抽出
- `POST /api/projects/[id]/complete`
  - 未入力フィールド向け AI 補完提案
- `POST /api/projects/[id]/generate`
  - マーケティングアセット生成
- `GET /api/projects/[id]/assets`
  - 生成済みアセット一覧
- `DELETE /api/projects/[id]/assets`
  - 生成済みアセット削除
- `POST /api/projects/[id]/invite`
  - オーナーが招待 URL を発行

### 9.5 招待

- `GET /api/invites/[token]`
  - 招待トークンの妥当性確認
- `POST /api/invites/[token]/accept`
  - 招待受諾
  - `project_members` に登録
  - 招待状態を `ACCEPTED` に更新

## 10. AI フロー

### 10.1 参照情報の組み立て

`src/lib/ai/prompt-builder.ts`

AI には次の情報を渡します。

- Global Assets
- Project Core
- Custom Fields
- URL 取得済み本文

継承フィールドが残っている場合は、プロンプト上でも要確認として扱います。

### 10.2 生成対象

- LP 構成案
- ダイレクトメール
- X 投稿 3 パターン
- LinkedIn 投稿
- 広告コピー 3 パターン
- メールマガジン
- 社内向け施策報告書

### 10.3 整合性チェック

各生成テンプレートは末尾に `[⚠️ 整合性チェック]` セクションを要求します。`extractWarnings()` がこの部分を抽出して `generated_assets.warnings` に保存します。

### 10.4 AI 補完

未入力フィールドのみを対象に JSON 配列形式で提案を返させ、画面側で個別適用します。

## 11. 実装上の注意

- `channels`、`options`、`products`、`warnings` は JSON 文字列で保存される
- クライアント側で配列として扱う前に毎回 `JSON.parse` が必要
- 招待 URL は `NEXT_PUBLIC_BASE_URL` に依存する
- `JWT_SECRET` 未設定でも動くが、本番では必ず明示設定すべき
- `.env.example` に現行未使用の設定が残っている場合は、実装に合わせて整理する
