import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getOwnedScene } from "@/lib/scenes";
import { presignDownload } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Redirect the owner to a short-lived download URL for one generated output.
 * Public/share access to outputs arrives with share links in milestone 5.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; outputId: string }> },
) {
  const { id, outputId } = await params;
  const { user, scene } = await getOwnedScene(id);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

  const output = await db.sceneOutput.findFirst({
    where: { id: outputId, sceneId: scene.id },
  });
  if (!output) return NextResponse.json({ error: "Output not found" }, { status: 404 });

  const url = await presignDownload(output.storageKey);
  return NextResponse.redirect(url, 302);
}
