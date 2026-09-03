import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOwnedScene, serializeAsset } from "@/lib/scenes";
import { headObject, keyBelongsToScene, deleteObject } from "@/lib/storage";
import { assetTypeForMime, maxBytesForType, MAX_ASSETS_PER_SCENE } from "@/lib/upload";

export const runtime = "nodejs";

/** List a scene's assets in upload order. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { user, scene } = await getOwnedScene(id);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

  const assets = await db.asset.findMany({
    where: { sceneId: scene.id },
    orderBy: { position: "asc" },
  });
  return NextResponse.json({ assets: assets.map(serializeAsset) });
}

const schema = z.object({
  key: z.string().trim().min(1).max(512),
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive(),
});

/**
 * Record an Asset after its file has been PUT to storage. We HEAD the object to
 * confirm it landed and to trust storage's size over the client's claim.
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
    return NextResponse.json({ error: "Scene is no longer editable" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { key, contentType } = parsed.data;

  if (!keyBelongsToScene(key, scene.id)) {
    return NextResponse.json({ error: "Key does not belong to this scene" }, { status: 400 });
  }

  // Idempotent: a retried confirm for the same object returns the existing row.
  const existing = await db.asset.findFirst({ where: { sceneId: scene.id, storageKey: key } });
  if (existing) return NextResponse.json({ asset: serializeAsset(existing) });

  const head = await headObject(key);
  if (!head) {
    return NextResponse.json({ error: "Upload not found in storage" }, { status: 409 });
  }

  const mimeType = head.contentType ?? contentType;
  const type = assetTypeForMime(mimeType);
  if (!type) {
    await deleteObject(key);
    return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
  }
  if (head.sizeBytes <= 0 || head.sizeBytes > maxBytesForType(type)) {
    await deleteObject(key);
    return NextResponse.json({ error: "File is empty or too large" }, { status: 413 });
  }

  // Count guard again — the presign check is advisory and can race parallel uploads.
  const count = await db.asset.count({ where: { sceneId: scene.id } });
  if (count >= MAX_ASSETS_PER_SCENE) {
    await deleteObject(key);
    return NextResponse.json(
      { error: `A scene can hold at most ${MAX_ASSETS_PER_SCENE} files` },
      { status: 409 },
    );
  }

  const asset = await db.asset.create({
    data: {
      sceneId: scene.id,
      type,
      storageKey: key,
      mimeType,
      sizeBytes: BigInt(head.sizeBytes),
      position: count,
    },
  });

  return NextResponse.json({ asset: serializeAsset(asset) }, { status: 201 });
}
