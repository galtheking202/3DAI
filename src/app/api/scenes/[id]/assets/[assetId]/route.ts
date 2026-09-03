import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getOwnedScene } from "@/lib/scenes";
import { deleteObject } from "@/lib/storage";

export const runtime = "nodejs";

/** Remove one asset from a DRAFT scene: storage object first, then the row. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> },
) {
  const { id, assetId } = await params;
  const { user, scene } = await getOwnedScene(id);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  if (scene.status !== "DRAFT") {
    return NextResponse.json({ error: "Scene is no longer editable" }, { status: 409 });
  }

  const asset = await db.asset.findFirst({
    where: { id: assetId, sceneId: scene.id },
  });
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  await deleteObject(asset.storageKey);
  await db.asset.delete({ where: { id: asset.id } });

  return new NextResponse(null, { status: 204 });
}
