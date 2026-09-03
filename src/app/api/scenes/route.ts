import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const schema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  kind: z.enum(["OBJECT", "APARTMENT", "VEHICLE", "OTHER"]).default("OBJECT"),
  description: z.string().trim().max(2000).optional(),
});

/**
 * Create a scene in DRAFT. Accepts a plain form post from /dashboard/new and
 * redirects to the new scene's page; assets are added there before generation.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/dashboard/new", env.APP_URL), 303);
  }

  const form = await req.formData().catch(() => null);
  const parsed = schema.safeParse({
    title: form?.get("title"),
    kind: form?.get("kind") ?? undefined,
    description: form?.get("description") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL("/dashboard/new?error=invalid", env.APP_URL), 303);
  }

  const scene = await db.scene.create({
    data: {
      ownerId: user.id,
      title: parsed.data.title,
      kind: parsed.data.kind,
      description: parsed.data.description,
    },
  });

  return NextResponse.redirect(
    new URL(`/dashboard/scenes/${scene.id}`, env.APP_URL),
    303,
  );
}
