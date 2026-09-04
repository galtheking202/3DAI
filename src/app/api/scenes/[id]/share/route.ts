import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { revokeShare, upsertShare } from "@/lib/share";

export const runtime = "nodejs";

const schema = z.object({
  // null = never expires. Capped at ~2 years so a link can't outlive the scene.
  expiresInDays: z.number().int().positive().max(730).nullable(),
  // null clears the password; a string sets one.
  password: z.string().min(4).max(200).nullable(),
});

/** Create the scene's share link, or update its password / expiry. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await upsertShare(id, user.id, parsed.data, env.APP_URL);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.code });
  }
  return NextResponse.json({ share: result.value });
}

/** Revoke the scene's share link. The slug stops working immediately. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const result = await revokeShare(id, user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.code });
  }
  return new NextResponse(null, { status: 204 });
}
