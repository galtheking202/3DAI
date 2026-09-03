import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hashToken, createSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const email = req.nextUrl.searchParams.get("email")?.toLowerCase().trim();

  if (!token || !email) {
    return NextResponse.redirect(new URL("/login?error=invalid", env.APP_URL), 303);
  }

  const row = await db.verificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!row || row.identifier !== email || row.expiresAt < new Date()) {
    if (row) await db.verificationToken.delete({ where: { id: row.id } }).catch(() => {});
    return NextResponse.redirect(new URL("/login?error=expired", env.APP_URL), 303);
  }

  // Consume this token and any other outstanding tokens for the address.
  await db.verificationToken.deleteMany({ where: { identifier: email } });

  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  await createSession(user.id);

  return NextResponse.redirect(new URL("/dashboard", env.APP_URL), 303);
}
