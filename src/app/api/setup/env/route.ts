import { existsSync, writeFileSync } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

const ENV_PATH = path.join(process.cwd(), ".env");

function normalizeBasePath(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function normalizeBaseUrl(value: unknown) {
  if (typeof value !== "string") return "http://localhost:3002";
  const trimmed = value.trim();
  return trimmed || "http://localhost:3002";
}

function envText({
  jwtSecret,
  baseUrl,
  basePath,
}: {
  jwtSecret: string;
  baseUrl: string;
  basePath: string;
}) {
  return [
    "# セッション署名用の秘密鍵",
    `JWT_SECRET=${jwtSecret}`,
    "",
    "# 外部公開 URL（招待リンクの生成に使用）",
    `NEXT_PUBLIC_BASE_URL=${baseUrl}`,
    "",
    "# サブパス配備時のみ設定（例: /struct）。ルート配備の場合は空のまま",
    `NEXT_PUBLIC_BASE_PATH=${basePath}`,
    "",
    "# true にすると誰でも /signup から登録可能。DB が空の場合（初回）は常に登録できます",
    "ALLOW_PUBLIC_SIGNUP=false",
    "",
    "# メール送信（未設定の場合は無効）",
    "SMTP_HOST=",
    "SMTP_PORT=587",
    "SMTP_USER=",
    "SMTP_PASS=",
    "SMTP_FROM=Struct <noreply@example.com>",
    "",
  ].join("\n");
}

export async function GET() {
  return NextResponse.json({
    env_file_exists: existsSync(ENV_PATH),
    env_configured: Boolean(process.env.JWT_SECRET),
    suggested_jwt_secret: randomBytes(32).toString("hex"),
    suggested_base_url: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3002",
    suggested_base_path: process.env.NEXT_PUBLIC_BASE_PATH || "",
  });
}

export async function POST(request: Request) {
  if (process.env.JWT_SECRET) {
    return NextResponse.json({ error: ".env はすでに設定されています" }, { status: 409 });
  }

  if (existsSync(ENV_PATH)) {
    return NextResponse.json(
      { error: ".env ファイルは存在しますが JWT_SECRET が読み込まれていません。サーバーを再起動してください。" },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const jwtSecret =
    typeof body.jwtSecret === "string" && body.jwtSecret.trim()
      ? body.jwtSecret.trim()
      : randomBytes(32).toString("hex");

  if (jwtSecret.length < 32) {
    return NextResponse.json({ error: "JWT_SECRET は32文字以上で入力してください" }, { status: 400 });
  }

  const baseUrl = normalizeBaseUrl(body.baseUrl);
  const basePath = normalizeBasePath(body.basePath);

  writeFileSync(ENV_PATH, envText({ jwtSecret, baseUrl, basePath }), { encoding: "utf8", flag: "wx" });

  process.env.JWT_SECRET = jwtSecret;
  process.env.NEXT_PUBLIC_BASE_URL = baseUrl;
  process.env.NEXT_PUBLIC_BASE_PATH = basePath;
  process.env.ALLOW_PUBLIC_SIGNUP = "false";

  return NextResponse.json({ success: true });
}
