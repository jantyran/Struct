# Struct — マーケティング資産エンジン

過去の成功構造をコピーし、AIで最適化して再生産するマーケティングプラットフォーム。

## 機能

- **3層データ構造**: Global Assets / Project Core / Project Custom
- **プロジェクトクローン**: 定義のみ or 定義+値（継承フラグ付き）の2モード
- **AIマルチチャネル生成**: LP・DM・SNS・広告コピー・メールマガジン・社内報告書
- **AI推論補完**: 未入力フィールドを文脈から自動推測
- **URLクローリング**: URL型フィールドからAIが内容を抽出
- **整合性チェック**: 生成物内の参照情報を検証

## セットアップ

```bash
cp .env.example .env
# .env に ANTHROPIC_API_KEY を設定

npm install
npm run dev
```

ブラウザで http://localhost:3002 を開く

## ポート

3002

## 技術スタック

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- SQLite (better-sqlite3)
- Anthropic Claude API
