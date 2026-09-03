import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOwnedScene } from "@/lib/scenes";
import { assetKey, presignUpload } from "@/lib/storage";
import {
  assetTypeForMime,
  maxBytesForType,
  MAX_ASSETS_PER_SCENE,
} from "@/lib/upload";

export const runtime = "nodejs";

const schema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive(),
});

/**
 * Issue a presigned PUT so the browser can upload one file straight to storage.
 * The Asset row is not created here — see the confirm route.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { user, scene } = await getOwnedScene(id);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  if (scene.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Scene is no longer editable" },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { filename, contentType, sizeBytes } = parsed.data;

  const type = assetTypeForMime(contentType);
  if (!type) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
  }
  if (sizeBytes > maxBytesForType(type)) {
    return NextResponse.json({ error: "File is too large" }, { status: 413 });
  }

  const count = await db.asset.count({ where: { sceneId: scene.id } });
  if (count >= MAX_ASSETS_PER_SCENE) {
    return NextResponse.json(
      { error: `A scene can hold at most ${MAX_ASSETS_PER_SCENE} files` },
      { status: 409 },
    );
  }

  const key = assetKey(scene.id, filename);
  const uploadUrl = await presignUpload(key, contentType);

  return NextResponse.json({ key, uploadUrl });
}
