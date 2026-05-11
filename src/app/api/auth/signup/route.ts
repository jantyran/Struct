import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { attachSessionCookie, createSessionToken } from "@/lib/auth";
import { seedSystemRoles } from "@/lib/permissions";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getDefaultOrganizationId } from "@/lib/organization-settings";
import { isEmailConfigured, sendWelcomeEmail } from "@/lib/email";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  const db = getDb();

  // ユーザーが1人もいない場合は初回セットアップとして ALLOW_PUBLIC_SIGNUP を無視して許可
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  const isFirstSetup = userCount === 0;

  if (!isFirstSetup && process.env.ALLOW_PUBLIC_SIGNUP !== 'true') {
    return NextResponse.json({ error: "新規登録は現在停止されています" }, { status: 403 });
  }

  if (!process.env.JWT_SECRET) {
    return NextResponse.json(
      {
        error: "JWT_SECRET 環境変数が設定されていません。.env ファイルを作成してください。",
        requires_env_setup: true,
      },
      { status: 500 }
    );
  }

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

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return NextResponse.json({ error: "このメールアドレスは既に登録されています" }, { status: 400 });
  }

  const id = uuidv4();
  const passwordHash = await bcrypt.hash(password, 10);
  const organizationId = getDefaultOrganizationId(db);
  const systemRole = isFirstSetup ? 'SYSTEM_ADMIN' : 'USER';

  seedSystemRoles(db);

  db.prepare('INSERT INTO users (id, email, password_hash, name, organization_id, system_role) VALUES (?, ?, ?, ?, ?, ?)').run(
    id,
    email.toLowerCase(),
    passwordHash,
    name || null,
    organizationId,
    systemRole
  );

  // ウェルカムメール（SMTP設定済みの場合のみ。失敗してもサインアップは完了とする）
  if (isEmailConfigured()) {
    sendWelcomeEmail(email.toLowerCase(), name || null).catch(() => {});
  }

  const token = await createSessionToken(id);
  return attachSessionCookie(
    NextResponse.json({ success: true, user: { id, email, name } }),
    token
  );
}
