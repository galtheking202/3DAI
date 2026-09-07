import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { enqueueGeneration } from "@/lib/jobs";

export const runtime = "nodejs";

/**
 * Queue a 3D generation run for the scene. Works as both the first "Generate"
 * and the "Try again" after a failure — `enqueueGeneration` enforces which
 * states are eligible. An optional `{ engine }` in the body picks the
 * generation engine and is remembered on the scene.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { engine?: unknown } | null;
  const engine = typeof body?.engine === "string" ? body.engine : undefined;

  const result = await enqueueGeneration(id, user.id, engine);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.code });
  }
  return NextResponse.json({ status: "QUEUED" }, { status: 202 });
}
