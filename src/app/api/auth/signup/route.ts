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

  const { email, password, name, invite_token } = await request.json() as {
    email?: string;
    password?: string;
    name?: string;
    invite_token?: string;
  };

  if (!email || !password) {
    return NextResponse.json({ error: "メールアドレスとパスワードが必要です" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "パスワードは8文字以上で入力してください" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // 招待トークンの検証
  let invitation: { id: string; project_id: string; email: string; role: string; expires_at: string; status: string } | undefined;
  let inviteProjectOrgId: string | null = null;
  if (invite_token && typeof invite_token === 'string') {
    invitation = db.prepare(`
      SELECT * FROM invitations WHERE token = ? AND status = 'PENDING'
    `).get(invite_token.trim()) as typeof invitation;

    if (!invitation) {
      return NextResponse.json({ error: "有効な招待が見つかりません" }, { status: 400 });
    }
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: "招待の有効期限が切れています" }, { status: 400 });
    }
    if (invitation.email.toLowerCase() !== normalizedEmail) {
      return NextResponse.json({ error: "招待されたメールアドレスと一致しません" }, { status: 400 });
    }

    const proj = db.prepare('SELECT organization_id FROM projects WHERE id = ?').get(invitation.project_id) as { organization_id?: string | null } | undefined;
    inviteProjectOrgId = proj?.organization_id ?? null;
  }

  // 初回セットアップでもなく、公開サインアップもオフで、有効な招待もない場合は拒否
  if (!isFirstSetup && process.env.ALLOW_PUBLIC_SIGNUP !== 'true' && !invitation) {
    return NextResponse.json({ error: "新規登録は現在停止されています" }, { status: 403 });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail) as { id: string } | undefined;
  if (existing && !isFirstSetup) {
    return NextResponse.json({ error: "このメールアドレスは既に登録されています" }, { status: 400 });
  }

  const id = existing?.id || uuidv4();
  const passwordHash = await bcrypt.hash(password, 10);
  const organizationId = inviteProjectOrgId || getDefaultOrganizationId(db);
  const systemRole = isFirstSetup ? 'SYSTEM_ADMIN' : 'USER';

  seedSystemRoles(db);

  const tx = db.transaction(() => {
    if (existing && isFirstSetup) {
      db.prepare(`
        UPDATE users
        SET password_hash = ?, name = ?, organization_id = COALESCE(organization_id, ?), system_role = 'SYSTEM_ADMIN'
        WHERE id = ?
      `).run(passwordHash, name?.trim() || null, organizationId, id);
    } else {
      db.prepare('INSERT INTO users (id, email, password_hash, name, organization_id, system_role) VALUES (?, ?, ?, ?, ?, ?)').run(
        id,
        normalizedEmail,
        passwordHash,
        name?.trim() || null,
        organizationId,
        systemRole
      );
    }

    // 招待経由の場合は自動でプロジェクトメンバーに追加し招待を受諾済みにする
    if (invitation) {
      db.prepare(`
        INSERT OR IGNORE INTO project_members (id, project_id, user_id, role)
        VALUES (?, ?, ?, ?)
      `).run(uuidv4(), invitation.project_id, id, invitation.role);

      db.prepare(`
        UPDATE invitations SET status = 'ACCEPTED' WHERE id = ?
      `).run(invitation.id);
    }
  });
  tx();

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
