import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, readdirSync, unlinkSync, statSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const dbPath = path.join(rootDir, 'data', 'struct.db');
const backupDir = path.join(rootDir, 'data', 'backups');

if (!existsSync(dbPath)) {
  console.log('Database file does not exist, skipping backup.');
  process.exit(0);
}

mkdirSync(backupDir, { recursive: true });

const now = new Date();
const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
const backupFile = path.join(backupDir, `struct_${timestamp}.db`);

const db = new Database(dbPath);
try {
  // better-sqlite3 のオンラインバックアップ API を使用 (WALモード完全対応)
  await db.backup(backupFile);
  console.log(`✓ DB バックアップ完了: ${backupFile}`);

  // 7日以上前の古いバックアップを削除
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const files = readdirSync(backupDir);
  for (const file of files) {
    if (file.startsWith('struct_') && file.endsWith('.db')) {
      const fullPath = path.join(backupDir, file);
      const stat = statSync(fullPath);
      if (stat.mtimeMs < sevenDaysAgo) {
        unlinkSync(fullPath);
        console.log(`- 古いバックアップを削除: ${file}`);
      }
    }
  }
} catch (err) {
  console.error('Backup failed:', err);
  process.exit(1);
} finally {
  db.close();
}
