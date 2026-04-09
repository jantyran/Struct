import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
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

  // 初回ログイン用のGlobalAssets作成
  db.prepare('INSERT INTO global_assets (id, user_id) VALUES (?, ?)').run(uuidv4(), id);

  await createSession(id);
  return NextResponse.json({ success: true, user: { id, email, name } });
}
