# Struct への貢献ガイド

Struct へのコントリビュートに興味を持っていただきありがとうございます。  
バグ報告・機能提案・Pull Request、どんな形の貢献も歓迎します。

---

## 始める前に

### 環境構築

```bash
git clone https://github.com/jantyran/Struct.git
cd Struct
cp .env.example .env   # JWT_SECRET を設定
npm install
npm run dev            # → http://localhost:3002（使用中なら 3003, 3004...）
```

### 技術スタック

| カテゴリ | 採用技術 |
|---|---|
| フレームワーク | Next.js 15 (App Router) |
| 言語 | TypeScript（strict: true） |
| DB | SQLite（better-sqlite3） |
| スタイル | Tailwind CSS |

---

## バグ報告・機能提案

[GitHub Issues](https://github.com/jantyran/Struct/issues) から報告してください。

**バグ報告の際に含めてほしいもの:**
- 再現手順（できるだけ具体的に）
- 期待する動作と実際の動作
- 環境情報（OS・Node.js バージョン・ブラウザ）

**機能提案の際に含めてほしいもの:**
- 解決したい課題・ユースケース
- 想定する動作のイメージ

---

## Pull Request

### 手順

1. このリポジトリを Fork する
2. feature ブランチを作成する（`git checkout -b feat/your-feature`）
3. 変更を実装する
4. 型チェックを通す（`npx tsc --noEmit`）
5. コミットする
6. Pull Request を作成する

### コミットメッセージ

プレフィックスを使って日本語で書いてください。

```
feat: ○○機能を追加
fix: ○○のバグを修正
refactor: ○○をリファクタリング
docs: ドキュメントを更新
chore: ビルド設定・依存関係の更新
```

### コードの規約

- **TypeScript**: `any` は原則禁止。型定義は `src/types/index.ts` に集約
- **文字サイズ**: `px` 禁止、`rem` クラスを使用（`text-xs` / `text-[0.625rem]` 等）
- **ファイルサイズ**: 単一ファイルは 300 行以内を目安に機能ごとに分割
- **認証**: API route の先頭で必ず `requireSession()` を呼ぶ
- **マルチテナント**: DB を読み書きする際は必ず `WHERE organization_id = ?` を含める
- **コメント**: 「なぜそうしたか」が自明でない場合のみ記述

### PR を送る前のチェックリスト

- [ ] `npx tsc --noEmit` でエラーがない
- [ ] `npm run build` が通る
- [ ] 新機能には動作確認手順を PR 説明に記載している
- [ ] DB スキーマを変更した場合は `src/lib/db/index.ts` の `runMigration` に番号付きで追記している

---

## ライセンス

このプロジェクトは [AGPL-3.0](./LICENSE) のもとで公開されています。  
Pull Request を送ることで、あなたの貢献が同ライセンスのもとで公開されることに同意したとみなします。
