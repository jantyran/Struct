import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { attachSessionCookie, createSessionToken } from "@/lib/auth";
import { seedSystemRoles } from "@/lib/permissions";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getDefaultOrganizationId } from "@/lib/organization-settings";
import { isEmailConfigured, sendWelcomeEmail } from "@/lib/email";
import { seedOnboardingSampleData } from "@/lib/onboarding-sample-data";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  const db = getDb();

  // 管理者が1人もいない場合は初回セットアップとして ALLOW_PUBLIC_SIGNUP を無視して許可
  const adminCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE system_role = 'SYSTEM_ADMIN'").get() as { count: number }).count;
  const isFirstSetup = adminCount === 0;

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

  const normalizedEmail = email.toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail) as { id: string } | undefined;
  if (existing && !isFirstSetup) {
    return NextResponse.json({ error: "このメールアドレスは既に登録されています" }, { status: 400 });
  }

  const id = existing?.id || uuidv4();
  const passwordHash = await bcrypt.hash(password, 10);
  const organizationId = getDefaultOrganizationId(db);
  const systemRole = isFirstSetup ? 'SYSTEM_ADMIN' : 'USER';

  seedSystemRoles(db);

  if (existing && isFirstSetup) {
    db.prepare(`
      UPDATE users
      SET password_hash = ?, name = ?, organization_id = COALESCE(organization_id, ?), system_role = 'SYSTEM_ADMIN'
      WHERE id = ?
    `).run(passwordHash, name || null, organizationId, id);
  } else {
    db.prepare('INSERT INTO users (id, email, password_hash, name, organization_id, system_role) VALUES (?, ?, ?, ?, ?, ?)').run(
      id,
      normalizedEmail,
      passwordHash,
      name || null,
      organizationId,
      systemRole
    );
  }

  // ウェルカムメール（SMTP設定済みの場合のみ。失敗してもサインアップは完了とする）
  if (isEmailConfigured()) {
    sendWelcomeEmail(email.toLowerCase(), name || null).catch(() => {});
  }

  if (isFirstSetup) {
    await seedOnboardingSampleData(db, { adminId: id, organizationId });
  }

  const token = await createSessionToken(id);
  return attachSessionCookie(
    NextResponse.json({ success: true, user: { id, email: normalizedEmail, name } }),
    token
  );
}
