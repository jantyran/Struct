import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  let user;
  try {
    user = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // パスワード変更試行のレートリミット: ユーザーごとに 5回/分 まで
  const rl = checkRateLimit(`password:${user.id}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "リクエストが多すぎます。しばらくしてから再試行してください。" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    );
  }

  const { currentPassword, nextPassword } = await request.json();

  if (!currentPassword || !nextPassword) {
    return NextResponse.json({ error: "現在のパスワードと新しいパスワードが必要です" }, { status: 400 });
  }

  if (nextPassword.length < 8) {
    return NextResponse.json({ error: "新しいパスワードは8文字以上で入力してください" }, { status: 400 });
  }

  const db = getDb();
  const currentUser = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(user.id) as { id: string; password_hash: string } | undefined;

  if (!currentUser) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  const passwordOk = await bcrypt.compare(currentPassword, currentUser.password_hash);
  if (!passwordOk) {
    return NextResponse.json({ error: "現在のパスワードが正しくありません" }, { status: 401 });
  }

  const nextHash = await bcrypt.hash(nextPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(nextHash, user.id);

  return NextResponse.json({ success: true });
}
