import { NextResponse, type NextRequest } from "next/server";
import { getOwnedScene } from "@/lib/scenes";
import { generationState } from "@/lib/jobs";

export const runtime = "nodejs";

/** Generation snapshot for the scene, polled by the client while a run is live. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { user, scene } = await getOwnedScene(id);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

  const state = await generationState(scene.id);
  return NextResponse.json(state, {
    headers: { "Cache-Control": "no-store" },
  });
}
