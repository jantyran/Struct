# Struct

認証付きで運用するマーケティング資産管理アプリです。Global Assets とプロジェクト情報を構造化して保持し、AI で各種マーケティングアセットを生成します。

## 主な機能

- Global Assets の管理
  - 会社情報、ブランドボイス、ガイドライン、製品情報をユーザー単位で保持
- プロジェクト管理
  - 作成、編集、削除、ステータス管理
  - Project Core と Custom Fields による情報構造化
- プロジェクト複製
  - 定義のみ複製
  - 値を含めて複製し、継承フィールドとして要確認表示
- AI 補完と AI 生成
  - 未入力フィールドの補完提案
  - LP、DM、X 投稿、LinkedIn 投稿、広告コピー、メール、社内報告書を生成
- URL クロール
  - URL 型カスタムフィールドから本文を抽出して AI の参照情報に追加
- 共同作業
  - オーナーによるプロジェクト招待
  - 招待 URL 経由でメンバー参加

## 技術スタック

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- SQLite (`better-sqlite3`)
- Anthropic SDK
- JWT セッション (`jose`)
- パスワードハッシュ (`bcryptjs`)

## セットアップ

### 推奨環境
- Node.js v23 以上

### 手順
```bash
cp .env.example .env
npm install
npm run dev
```

`.env` では以下を設定してください。外部からアクセスする場合は `NEXT_PUBLIC_BASE_URL` にサーバーのパブリック IP またはドメインを設定する必要があります。

```env
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=任意の長い文字列
NEXT_PUBLIC_BASE_URL=http://133.18.123.87:3002 (外部アクセスの例)
```

開発サーバーはデフォルトで `0.0.0.0:3002` で起動し、外部からの接続を受け付けます。

## データ保存

- SQLite ファイル: `data/struct.db`
- SQLite の `WAL` と `foreign_keys` を有効化

## 認証

- `/signup` でユーザー登録
- `/login` でログイン
- セッションは `session` Cookie に JWT として保存

## 補足

- アーキテクチャ詳細は [docs/architecture.md](/home/ubuntu/claudePark/eidos/docs/architecture.md) を参照
- ドキュメント一覧は [docs/README.md](/home/ubuntu/claudePark/eidos/docs/README.md) を参照
