import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`reset:${ip}`, 10, 600_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'リクエストが多すぎます。しばらくしてから再試行してください。' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const { token, password } = await request.json();
  if (!token || !password) {
    return NextResponse.json({ error: 'トークンと新しいパスワードが必要です' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'パスワードは8文字以上で入力してください' }, { status: 400 });
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const db = getDb();

  const record = db.prepare(
    'SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?'
  ).get(tokenHash) as { id: string; user_id: string; expires_at: string; used_at: string | null } | undefined;

  if (!record) {
    return NextResponse.json({ error: 'リセットリンクが無効です' }, { status: 400 });
  }
  if (record.used_at) {
    return NextResponse.json({ error: 'このリンクはすでに使用済みです' }, { status: 400 });
  }
  if (new Date(record.expires_at) < new Date()) {
    return NextResponse.json({ error: 'リセットリンクの有効期限が切れています。もう一度お試しください。' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, record.user_id);
  db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    record.id
  );

  return NextResponse.json({ success: true });
}
