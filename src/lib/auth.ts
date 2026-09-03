import "server-only";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = await db.session.create({ data: { userId, expiresAt } });

  const jar = await cookies();
  jar.set(env.SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const sid = jar.get(env.SESSION_COOKIE)?.value;
  if (sid) {
    await db.session.delete({ where: { id: sid } }).catch(() => {});
  }
  jar.delete(env.SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const sid = jar.get(env.SESSION_COOKIE)?.value;
  if (!sid) return null;

  const session = await db.session.findUnique({
    where: { id: sid },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session.user;
}
