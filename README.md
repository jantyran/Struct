# Struct

**チームのプロジェクト・施策を構造化して管理する、セルフホスト型プロジェクト管理ツール**

SQLite 単体で動作するため Docker 不要。`git clone` → `npm install` → `npm run dev` の 3 ステップで即起動できます。

---

## 特徴

- **ゼロ依存でセルフホスト** — SQLite のみ。PostgreSQL・Redis・外部ストレージ不要
- **完全カスタマイズ可能なプロジェクト種別** — フェーズ・フィールド・UIレイアウトをチームの業務に合わせて定義
- **AI 生成コンテンツ** — Gemini / OpenAI / Anthropic を切り替えて使える AI 連携を標準搭載
- **マルチテナント対応** — 組織単位でデータをスコープ管理
- **モバイル対応** — スマートフォンからも操作できるレスポンシブ UI

---

## 機能一覧

### プロジェクト管理

- **プロジェクト種別** の定義と管理（種別ごとにフェーズ・フィールド・レイアウトを設定）
- **フェーズ管理** — Salesforce Path スタイルの進行ステップ UI
- **カスタムフィールド** — テキスト・数値・日付・選択肢・参照など多彩な型に対応
- **フィールドレイアウト** — 1列 / 2列・セクション単位のドラッグ&ドロップ配置
- **タブのDnD並び替え** — プロジェクト上部のタブをドラッグ&ドロップで自由に並び替え（即時保存）
- **グループ / 繰り返しグループ** — まとまりのある入力欄を構造化して管理
- **プロジェクト階層 / 関連プロジェクト** — 親子関係・依存関係による施策群の可視化
- **公開範囲設定** — 全体公開（public）/ チーム限定（team）/ 非公開（private）
- **ステータス管理** — 下書き / アクティブ / 完了 / アーカイブ
- **クローン機能** — 既存プロジェクトの構造やタスクをコピーして新規作成

### タスク管理

- **Todo** の作成・担当者割り当て・期日設定・優先度管理
- **マルチビュー** — リスト / カンバン（DnD対応）/ ガントチャート（日程ドラッグ・拡大表示対応）
- **サブタスク** — 親子構造によるタスク分解
- **ステータス** — 未着手 / 進行中 / 完了
- **マイタスク** — 自分にアサインされたタスクを横断的に確認（`/my-todos`）
- **ダッシュボード** — 今週の期限・期限超過・チームの急ぎタスクを一覧表示

### ノート

- **Markdown ノート** — プロジェクトごとに複数ノートを作成・編集
- **ピン留め** — 重要なノートを上部に固定
- **リッチテキストエディタ** — Milkdown ベースのライブプレビューエディタ

### マスターデータ

- **任意のオブジェクト定義** — 取引先・商品・担当者など、業務に合わせたデータベースを構築
- **項目定義** — ラベル・型・選択肢・参照先を設定
- **参照 / 複数参照** — オブジェクト間のリレーションを設定
- **レコード管理** — 一覧表示・検索・編集

### AI 連携 & セキュリティ

- **AI プロバイダ切り替え** — Gemini / OpenAI / Anthropic を設定画面から選択
- **APIキー暗号化保存** — AES-256-GCM による機密情報の安全な暗号化
- **生成コンテンツテンプレート** — チャネル・テキスト形式・トーン・必須要素・構成例を定義
- **プロジェクトからの生成** — 追加指示付きでプロジェクト情報をもとにコンテンツを生成
- **完了提案** — ノートや情報をもとに AI がプロジェクトの完了内容を提案
- **安全な外部クローラー** — プライベート IP / ループバック遮断（SSRF対策）

### チーム・権限管理

- **チーム管理** — 部署・グループ単位のチーム作成、リーダー / メンバー管理（`/settings/teams`）
- **チーム別進捗ダッシュボード** — チームメンバーのタスク進捗、遅延タスク、担当PJを俯瞰（`/teams`）
- **招待URL** — オーナーが発行した URL で新メンバーを招待
- **プロジェクトロール** — プロジェクトごとに閲覧 / 編集 / 管理の権限を付与
- **システムロール** — `manage_teams` を含む組織全体の管理権限を柔軟に制御（`/settings/roles`）
- **連絡先管理** — プロジェクトに関わる社外連絡先を登録

### ダッシュボード・レポート

- **ダッシュボード** — プロジェクト一覧・タスクサマリー・今週の期限をまとめて確認
- **マイページ** — 自分の担当プロジェクト・タスク・活動履歴
- **レポート** — タスク完了数・プロジェクト進行率のグラフ表示
- **停滞プロジェクト検出** — 更新が止まっているプロジェクトをダッシュボードでアラート

### その他

- **2画面表示** — 1つの画面でプロジェクト情報とタスクを同時に表示（デスクトップ）
- **シート** — プロジェクトごとのスプレッドシート風データ管理
- **グローバル検索** — プロジェクト・タスク・ノートをまとめて横断検索
- **キーボードショートカット** — 主要操作をキーボードで素早く実行
- **コンパクトモード / 文字サイズ設定** — UI 密度と文字サイズをユーザーごとに調整
- **オンライン安全バックアップ** — SQLite `VACUUM INTO` による整合性バックアップスクリプト
- **テスト自動化** — Vitest によるユニットテスト基盤（`npm test`）

---

## 技術スタック

| カテゴリ | 採用技術 |
|---|---|
| フレームワーク | Next.js 15 (App Router) |
| 言語 | TypeScript |
| UI | React 18 / Tailwind CSS |
| DB | SQLite (`better-sqlite3`, WAL モード) |
| 認証 | JWT (`jose`) / bcrypt |
| 暗号化 | Node.js `crypto` (AES-256-GCM) |
| テスト | Vitest |
| エディタ | Milkdown (ProseMirror ベース) |
| AI | Google Gemini / OpenAI / Anthropic |

---

## セットアップ

### 動作環境

- Node.js v20 以上（v22 LTS 推奨）
- macOS / Linux 推奨
- **Windows の場合**: `better-sqlite3` のネイティブビルドに [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022) と Python が必要です。インストール後に `npm install` を実行してください。WSL2 上での動作も可能です。

### クイックスタート（開発）

```bash
git clone https://github.com/jantyran/Struct.git
cd Struct
cp .env.example .env   # JWT_SECRET を書き換えるだけで動く
npm install
npm run dev            # → http://localhost:3002（使用中なら 3003, 3004...）
```

起動後、ターミナルに表示された URL（例: `http://localhost:3002/signup`）にアクセスして最初のアカウントを作成してください。  
**初回のみ** `ALLOW_PUBLIC_SIGNUP` の設定に関わらずサインアップできます。最初に登録したアカウントが自動的に管理者になります。

> **セキュリティ:** 初期セットアップ用エンドポイント `/api/setup/env` は `JWT_SECRET` が未設定の場合（初回起動時）のみ書き込みを受け付けます。`.env` に `JWT_SECRET` を設定した後は自動的に無効化されます。

### 本番デプロイ

```bash
cp .env.example .env
# .env を編集（下記「環境変数」参照）
npm install
npm run build
npm run start          # → http://0.0.0.0:38427
```

### テスト・保守運用コマンド

```bash
# ユニットテスト実行（Vitest）
npm test

# DB のオンライン安全バックアップ（WALモード対応 VACUUM INTO）
node scripts/backup.mjs
# バックアップ先: data/backups/struct-backup-YYYY-MM-DDTHH-mm-ss.db
```

### 環境変数

| 変数 | 説明 | 必須 |
|---|---|---|
| `JWT_SECRET` | セッション署名用の秘密鍵（長いランダム文字列を設定） | ✅ |
| `APP_ENCRYPTION_KEY` | AI APIキーなどの暗号化用キー（省略時は `JWT_SECRET` から派生） | 推奨 |
| `NEXT_PUBLIC_BASE_URL` | 外部公開 URL（招待リンク生成などに使用） | 推奨 |
| `NEXT_PUBLIC_BASE_PATH` | サブパス配備時のみ設定（例: `/struct`）。ルート配備は空白 | — |
| `ALLOW_PUBLIC_SIGNUP` | `true` にすると誰でも `/signup` から登録可能 | — |
| `SMTP_HOST` | パスワードリセット・通知メール送信用の SMTP サーバーホスト | — |
| `SMTP_PORT` | SMTP ポート（通常 587 または 465） | — |
| `SMTP_USER` | SMTP 認証ユーザー名 | — |
| `SMTP_PASS` | SMTP 認証パスワード（アプリパスワード等） | — |
| `SMTP_FROM` | 送信元メールアドレス表記（例: `Struct <noreply@example.com>`） | — |

> AI の API キーは `.env` ではなく、ログイン後の **設定 › AI設定** から登録します（AES-256-GCM により暗号化されて保存されます）。

---

## セキュリティ

### データの暗号化保存

登録された AI API キー（Gemini, OpenAI, Anthropic）は、Node.js 標準の `crypto` モジュールを用いた **AES-256-GCM**（認証付き暗号）により安全に暗号化されてデータベースに格納されます。暗号鍵には `APP_ENCRYPTION_KEY`（未設定時は `JWT_SECRET`）が使用されます。

### リバースプロキシの推奨

ブルートフォース対策のレートリミットはクライアントIPを `X-Forwarded-For` ヘッダーから識別します。**Nginx や Caddy などのリバースプロキシ経由での運用を強く推奨します。** プロキシを経由しない場合、IPヘッダーのスプーフィングによってレートリミットが回避される可能性があります。

Nginx の設定例：

```nginx
location / {
    proxy_pass http://localhost:38427;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### `.env` の管理

`.env` は `.gitignore` に含まれており、リポジトリには含まれません。`JWT_SECRET` には十分に長いランダム文字列（64文字以上推奨）を設定し、外部に漏れないよう管理してください。

---

## データ

- SQLite ファイル: `data/struct.db`（`.gitignore` 済み）
- WAL モード・外部キー制約を有効化
- スキーマは起動時に自動適用（`CREATE TABLE IF NOT EXISTS` + バージョン管理済みマイグレーション）

---

## ライセンス

[AGPL-3.0](./LICENSE)

---

## コントリビュート

Issue・PR 歓迎です。詳細は [CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。

アーキテクチャ詳細: [`docs/architecture.md`](./docs/architecture.md)
