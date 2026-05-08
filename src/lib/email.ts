import nodemailer from 'nodemailer';

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const FROM = process.env.SMTP_FROM ?? `Struct <${process.env.SMTP_USER}>`;

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const transporter = createTransport();
  await transporter.sendMail({
    from: FROM,
    to,
    subject: '【Struct】パスワードのリセット',
    text: `パスワードのリセットが申請されました。\n\n以下のリンクから1時間以内に新しいパスワードを設定してください。\n\n${resetUrl}\n\nこのリンクは1時間で無効になります。\n心当たりがない場合は無視してください。`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f4fbff;">
        <h2 style="font-size:18px;font-weight:700;color:#193243;margin-bottom:8px;">パスワードのリセット</h2>
        <p style="color:#4f6c7b;font-size:14px;line-height:1.7;margin-bottom:24px;">
          パスワードリセットの申請を受け付けました。<br>
          以下のボタンから1時間以内に新しいパスワードを設定してください。
        </p>
        <a href="${resetUrl}" style="display:inline-block;background:#0f9ab1;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
          パスワードをリセットする
        </a>
        <p style="color:#6f8794;font-size:12px;margin-top:24px;">
          このリンクは1時間で無効になります。<br>
          心当たりがない場合はこのメールを無視してください。
        </p>
      </div>
    `,
  });
}

export async function sendWelcomeEmail(to: string, name: string | null): Promise<void> {
  const transporter = createTransport();
  const displayName = name ?? to.split('@')[0];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3002';
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

  await transporter.sendMail({
    from: FROM,
    to,
    subject: '【Struct】アカウントが作成されました',
    text: `${displayName} さん、Struct へようこそ！\n\nアカウントの作成が完了しました。\n以下のURLからログインしてください。\n\n${baseUrl}${basePath}/login`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f4fbff;">
        <h2 style="font-size:18px;font-weight:700;color:#193243;margin-bottom:8px;">Struct へようこそ！</h2>
        <p style="color:#4f6c7b;font-size:14px;line-height:1.7;margin-bottom:24px;">
          ${displayName} さん、アカウントの作成が完了しました。<br>
          以下からログインしてプロジェクト管理を始めましょう。
        </p>
        <a href="${baseUrl}${basePath}/login" style="display:inline-block;background:#0f9ab1;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
          ログインする
        </a>
      </div>
    `,
  });
}
