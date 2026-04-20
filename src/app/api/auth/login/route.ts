import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { attachSessionCookie, createSessionToken } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  // ブルートフォース対策: IPごとに 10回/分 まで
  const ip = getClientIp(request);
  const rl = checkRateLimit(`login:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "リクエストが多すぎます。しばらくしてから再試行してください。" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    );
  }

  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "メールアドレスとパスワードが必要です" }, { status: 400 });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as any;

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return NextResponse.json({ error: "メールアドレスまたはパスワードが正しくありません" }, { status: 401 });
  }

  try {
    const token = await createSessionToken(user.id);
    return attachSessionCookie(
      NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name } }),
      token
    );
  } catch (err) {
    console.error('[login] createSession failed:', err);
    return NextResponse.json(
      { error: 'セッション作成に失敗しました: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}
