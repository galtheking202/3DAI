import "server-only";
import type { Asset } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { SceneAsset } from "@/lib/upload";

/** JSON-safe shape of an Asset for the client (BigInt -> number, dates -> ISO). */
export function serializeAsset(a: Asset): SceneAsset {
  return {
    id: a.id,
    type: a.type,
    storageKey: a.storageKey,
    mimeType: a.mimeType,
    sizeBytes: Number(a.sizeBytes),
    position: a.position,
    createdAt: a.createdAt.toISOString(),
  };
}

/**
 * Load a scene only if the signed-in user owns it. `user` is null when there is
 * no session; `scene` is null when it is missing or owned by someone else — the
 * two cases map to 401 and 404 respectively in API routes.
 */
export async function getOwnedScene(sceneId: string) {
  const user = await getCurrentUser();
  if (!user) return { user: null, scene: null } as const;

  const scene = await db.scene.findFirst({
    where: { id: sceneId, ownerId: user.id },
  });
  return { user, scene } as const;
}
