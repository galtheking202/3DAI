import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { confirmAvatarUpload, removeAvatar } from "@/lib/avatar";

export const runtime = "nodejs";

const schema = z.object({ key: z.string().trim().min(1).max(512) });

/** Record an avatar after its file has been PUT to storage. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await confirmAvatarUpload(user, parsed.data.key);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.code });
  }
  return NextResponse.json(result.value);
}

/** Clear the user's avatar. */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await removeAvatar(user);
  return new NextResponse(null, { status: 204 });
}
