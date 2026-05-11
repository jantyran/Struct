import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const userCount = (db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number }).count;
  const envConfigured = Boolean(process.env.JWT_SECRET);

  return NextResponse.json(
    {
      env_configured: envConfigured,
      needs_initial_setup: userCount === 0,
      public_signup_enabled: process.env.ALLOW_PUBLIC_SIGNUP === "true",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
