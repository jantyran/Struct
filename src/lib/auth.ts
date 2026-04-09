import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { getDb } from "./db";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "local-secret-key-struct-2026");

export async function createSession(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5d")
    .sign(SECRET);

  cookies().set("session", token, {
    maxAge: 60 * 60 * 24 * 5,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function getSession() {
  const token = cookies().get("session")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const userId = payload.userId as string;
    const db = getDb();
    const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(userId) as any;
    return user;
  } catch (error) {
    return null;
  }
}

export async function requireSession() {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export function deleteSession() {
  cookies().delete("session");
}
