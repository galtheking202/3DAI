import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { unlockCookieName, unlockToken, verifyPassword } from "@/lib/share";

export const runtime = "nodejs";

/**
 * Check a share link's password. On success set the unlock cookie and bounce
 * back to the viewer; on failure return to the gate with an error. Plain form
 * post, so it works before any JS has run.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const form = await req.formData().catch(() => null);
  const password = form?.get("password");

  const viewer = new URL(`/s/${slug}`, env.APP_URL);
  const link = await db.shareLink.findUnique({ where: { slug } });

  if (
    !link ||
    !link.passwordHash ||
    typeof password !== "string" ||
    !verifyPassword(password, link.passwordHash)
  ) {
    viewer.searchParams.set("error", "password");
    return NextResponse.redirect(viewer, 303);
  }

  const res = NextResponse.redirect(viewer, 303);
  res.cookies.set(unlockCookieName(slug), unlockToken(slug, link.passwordHash), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/s/${slug}`,
    // Outlives a viewing session without granting standing access; the link's
    // own expiry and revocation are still checked on every page load.
    maxAge: 12 * 60 * 60,
  });
  return res;
}
