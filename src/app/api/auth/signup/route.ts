import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { attachSessionCookie, createSessionToken } from "@/lib/auth";
import { seedSystemRoles } from "@/lib/permissions";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  // アカウント作成スパム対策: IPごとに 5回/分 まで
  const ip = getClientIp(request);
  const rl = checkRateLimit(`signup:${ip}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "リクエストが多すぎます。しばらくしてから再試行してください。" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    );
  }

  const { email, password, name } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "メールアドレスとパスワードが必要です" }, { status: 400 });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return NextResponse.json({ error: "このメールアドレスは既に登録されています" }, { status: 400 });
  }

  const id = uuidv4();
  const passwordHash = await bcrypt.hash(password, 10);

  db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)').run(
    id,
    email.toLowerCase(),
    passwordHash,
    name || null
  );

  seedSystemRoles(db);

  const token = await createSessionToken(id);
  return attachSessionCookie(
    NextResponse.json({ success: true, user: { id, email, name } }),
    token
  );
}
