#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_PATH="$SCRIPT_DIR/data/struct.db"
BACKUP_DIR="$SCRIPT_DIR/data/backups"

# DBバックアップ
if [ -f "$DB_PATH" ]; then
  mkdir -p "$BACKUP_DIR"
  BACKUP_FILE="$BACKUP_DIR/struct_$(date +%Y%m%d_%H%M%S).db"
  cp "$DB_PATH" "$BACKUP_FILE"
  echo "✓ DB バックアップ完了: $BACKUP_FILE"
  # 7日以上前のバックアップを削除
  find "$BACKUP_DIR" -name "struct_*.db" -mtime +7 -delete
fi

# ビルド
echo "→ ビルド中..."
npm run build

# 再起動
echo "→ サービス再起動..."
sudo systemctl restart struct.service

echo "✓ デプロイ完了"
