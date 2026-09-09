#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_PATH="$SCRIPT_DIR/data/struct.db"
BACKUP_DIR="$SCRIPT_DIR/data/backups"

# DBバックアップ (better-sqlite3 の WAL 安全なオンラインバックアップ API を使用)
if [ -f "$DB_PATH" ]; then
  node "$SCRIPT_DIR/scripts/backup.mjs"
fi

# ビルド
echo "→ ビルド中..."
npm run build

# 再起動
echo "→ サービス再起動..."
sudo systemctl restart struct.service

echo "✓ デプロイ完了"
