import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { getDb } from "./db";
import { systemPermissionsForUser } from "./permissions";
import { getUserOrganizationId } from "./organization-settings";
import { parseUserSettingsRow } from "./user-settings";

function getSecret(): Uint8Array {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error(
      "JWT_SECRET 環境変数が設定されていません。.env ファイルに JWT_SECRET を追加してください。"
    );
  }
  return new TextEncoder().encode(jwtSecret);
}

function shouldUseSecureCookie() {
  if (process.env.SESSION_COOKIE_SECURE) {
    return process.env.SESSION_COOKIE_SECURE === "true";
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (baseUrl) {
    return baseUrl.startsWith("https://");
  }

  return process.env.NODE_ENV === "production";
}

function sessionCookieOptions() {
  return {
    maxAge: 60 * 60 * 24 * 5,
    httpOnly: true,
    secure: shouldUseSecureCookie(),
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function createSessionToken(userId: string) {
  const secret = getSecret();
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5d")
    .sign(secret);
}

export async function createSession(userId: string) {
  const token = await createSessionToken(userId);
  const cookieStore = await cookies();
  cookieStore.set("session", token, sessionCookieOptions());
  return token;
}

export function attachSessionCookie(response: NextResponse, token: string) {
  response.cookies.set("session", token, sessionCookieOptions());
  return response;
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const userId = payload.userId as string;
    const db = getDb();
    const user = db.prepare('SELECT id, email, name, avatar_url, system_role, organization_id, user_settings FROM users WHERE id = ?').get(userId) as { id: string; email: string; name: string; avatar_url: string | null; system_role: string | null; organization_id: string | null; user_settings: string | null } | undefined;
    if (!user) return null;
    const organizationId = user.organization_id || getUserOrganizationId(db, user.id);
    return {
      ...user,
      organization_id: organizationId,
      settings: parseUserSettingsRow(user.user_settings),
      system_permissions: systemPermissionsForUser(db, user.id),
    };
  } catch (error) {
    return null;
  }
}

export type AuthUser = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export type AuthSessionResult =
  | { user: AuthUser; errorResponse: null }
  | { user: null; errorResponse: NextResponse };

export async function getAuthSession(): Promise<AuthSessionResult> {
  const user = await getSession();
  if (!user) {
    return { user: null, errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { user, errorResponse: null };
}

export async function requireSession() {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.delete("session");
  return response;
}
