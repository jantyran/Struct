import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { existsSync } from "fs";
import path from "path";

const ENV_PATH = path.join(process.cwd(), ".env");

export async function GET() {
  const db = getDb();
  const userCount = (db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number }).count;
  const adminCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE system_role = 'SYSTEM_ADMIN'").get() as { count: number }).count;
  const envFileExists = existsSync(ENV_PATH);
  const envConfigured = envFileExists && Boolean(process.env.JWT_SECRET);

  return NextResponse.json(
    {
      env_file_exists: envFileExists,
      env_configured: envConfigured,
      user_count: userCount,
      admin_count: adminCount,
      needs_initial_setup: adminCount === 0,
      public_signup_enabled: process.env.ALLOW_PUBLIC_SIGNUP === "true",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
