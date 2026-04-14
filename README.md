# Struct

Struct は、`MKTキャンペーン運用デスク` として使う認証付きのキャンペーン管理アプリです。  
キャンペーンやイベントごとの進行管理、構造化された情報管理、生成コンテンツ管理、AI 生成を 1 つの画面群で扱います。

## 主な機能

- プロジェクト管理
  - ユーザー定義の `プロジェクト種別` ごとに案件を管理
  - 種別ごとにフェーズ、フィールド、生成コンテンツを設定
  - フェーズはプロジェクト詳細上部のパス UI で管理
- Global Assets
  - 任意のオブジェクトを作成
  - オブジェクトごとに項目定義とレコードを管理
  - 項目は `参照` / `複数参照` で他オブジェクトを参照可能
- プロジェクト情報の構造化
  - 標準項目に加えて、設定由来の `フィールド` を案件ごとに入力
  - `1列` / `2列` レイアウトを設定可能
  - `グループ` / `繰り返しグループ` でまとまりのある入力にも対応
  - `参照` / `複数参照` で Global Assets のレコードを参照可能
- 生成コンテンツ管理
  - `生成コンテンツ設定` で出力テンプレートを定義
  - チャネル、テキスト形式、トーン、必須要素、構成例、指示を管理
  - 各プロジェクト種別には使う生成コンテンツだけを複数紐づけ
- AI 生成
  - AI プロバイダを設定画面から切り替え
  - `Gemini` / `OpenAI` / `Anthropic` に対応
  - API キー、モデル、Base URL をユーザー単位で保持
  - プロジェクト詳細から追加指示付きで生成可能
- 共同作業
  - オーナーによる招待 URL 発行
  - 招待受諾による共同編集

## 現在の画面構成

- `/`
  - ダッシュボード
- `/global-assets`
  - オブジェクト一覧と管理
- `/global-assets/[objectId]`
  - オブジェクト設定、項目設定、レコード管理
- `/project-types`
  - プロジェクト設定
- `/projects/[id]`
  - プロジェクト詳細、フェーズ管理、フィールド入力、生成コンテンツ生成・編集
- `/settings`
  - 設定ハブ
- `/settings/ai`
  - AI 設定
- `/settings/content-templates`
  - 生成コンテンツ設定
- `/about`, `/guide`
  - 公開向け説明ページ

## 技術スタック

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- SQLite (`better-sqlite3`)
- JWT セッション (`jose`)
- パスワードハッシュ (`bcryptjs`)
- AI API
  - Google Gemini
  - OpenAI
  - Anthropic

## セットアップ

### 推奨環境

- Node.js v23 以上

### 手順

```bash
cp .env.example .env
npm install
npm run dev
```

`.env` では以下を設定してください。

```env
JWT_SECRET=任意の長い文字列
NEXT_PUBLIC_BASE_URL=http://133.18.123.87:3002
NEXT_PUBLIC_BASE_PATH=
```

補足:

- ルート配備が既定です
- サブパス配備時のみ `NEXT_PUBLIC_BASE_PATH=/struct` のように設定してください
- AI API キーは `.env` ではなく、ログイン後の `設定 > AI設定` から保存する運用です

開発サーバーは既定で `0.0.0.0:3002` で起動します。

## データ保存

- SQLite ファイル: `data/struct.db`
- `WAL` と `foreign_keys` を有効化

## 認証

- `/signup` でユーザー登録
- `/login` でログイン
- セッションは `session` Cookie に JWT として保存

## 今後の実装予定

- プロジェクトごとの `ToDo`
- プロジェクトごとの `ノート`

どちらも案件に紐づく日常運用情報として扱い、進行管理とメモ蓄積をプロジェクト画面内で完結できるようにする予定です。

## 補足

- アーキテクチャ詳細は [docs/architecture.md](/home/ubuntu/claudePark/Struct/docs/architecture.md) を参照
- ドキュメント一覧は [docs/README.md](/home/ubuntu/claudePark/Struct/docs/README.md) を参照
