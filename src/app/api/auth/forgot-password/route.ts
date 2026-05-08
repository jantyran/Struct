import { NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { isEmailConfigured, sendPasswordResetEmail } from '@/lib/email';
import { withBasePath } from '@/lib/paths';

export async function POST(request: Request) {
  // IPごとに 3回/10分 まで（メール爆弾対策）
  const ip = getClientIp(request);
  const rl = checkRateLimit(`forgot:${ip}`, 3, 600_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'リクエストが多すぎます。しばらくしてから再試行してください。' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const { email } = await request.json();
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'メールアドレスが必要です' }, { status: 400 });
  }

  // メール未設定の場合は管理者対応を促す
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: 'メール送信が設定されていません。管理者にパスワードリセットを依頼してください。' },
      { status: 503 }
    );
  }

  const db = getDb();
  const user = db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(email.toLowerCase()) as
    | { id: string; email: string; name: string | null }
    | undefined;

  // ユーザーが存在しない場合でも成功レスポンスを返す（メールアドレス列挙攻撃対策）
  if (!user) {
    return NextResponse.json({ success: true });
  }

  // 既存の未使用トークンを無効化
  db.prepare(`DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL`).run(user.id);

  // トークン生成（32バイトのランダム値、ハッシュして保存）
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1時間

  db.prepare(
    'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)'
  ).run(uuidv4(), user.id, tokenHash, expiresAt);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3002';
  const resetUrl = `${baseUrl}${withBasePath('/reset-password')}?token=${rawToken}`;

  await sendPasswordResetEmail(user.email, resetUrl);

  return NextResponse.json({ success: true });
}
