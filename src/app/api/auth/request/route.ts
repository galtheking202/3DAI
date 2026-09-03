import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hashToken, newToken, TOKEN_TTL_MS } from "@/lib/auth";
import { sendMagicLink } from "@/lib/email";

export const runtime = "nodejs";

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const parsed = schema.safeParse({ email: form?.get("email") });

  if (!parsed.success) {
    return NextResponse.redirect(new URL("/login?error=email", env.APP_URL), 303);
  }

  const email = parsed.data.email.toLowerCase().trim();
  const raw = newToken();

  await db.verificationToken.create({
    data: {
      identifier: email,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const url = new URL("/api/auth/callback", env.APP_URL);
  url.searchParams.set("token", raw);
  url.searchParams.set("email", email);

  await sendMagicLink(email, url.toString());

  return NextResponse.redirect(new URL("/login?sent=1", env.APP_URL), 303);
}
