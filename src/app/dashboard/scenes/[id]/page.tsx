import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getOwnedScene, serializeAsset } from "@/lib/scenes";
import { generationState } from "@/lib/jobs";
import { presignDownload } from "@/lib/storage";
import type { ViewableOutput } from "@/lib/outputs";
import { activeShare } from "@/lib/share";
import { env } from "@/lib/env";
import AssetUploader from "./AssetUploader";
import GeneratePanel from "./GeneratePanel";
import SceneViewer from "@/components/viewer/SceneViewer";
import SharePanel from "./SharePanel";

const KIND_LABEL: Record<string, string> = {
  OBJECT: "Object",
  APARTMENT: "Apartment / space",
  VEHICLE: "Vehicle",
  OTHER: "Other",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  QUEUED: "Queued",
  PROCESSING: "Processing",
  READY: "Ready",
  FAILED: "Failed",
};

export default async function ScenePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, scene } = await getOwnedScene(id);
  if (!user) redirect(`/login?next=/dashboard/scenes/${id}`);
  if (!scene) notFound();

  const assets = await db.asset.findMany({
    where: { sceneId: scene.id },
    orderBy: { position: "asc" },
  });

  const genState = (await generationState(scene.id))!;
  const editable = scene.status === "DRAFT";

  // Presign the outputs here rather than having the viewer round-trip for URLs:
  // the page is already per-request and owner-scoped, so the client can start
  // fetching geometry on first paint. URLs are short-lived (see storage.ts).
  const outputRows = await db.sceneOutput.findMany({
    where: { sceneId: scene.id },
    orderBy: { createdAt: "asc" },
  });
  const viewable: ViewableOutput[] = await Promise.all(
    outputRows.map(async (o) => ({
      id: o.id,
      format: o.format,
      url: await presignDownload(o.storageKey),
      sizeBytes:
        o.meta && typeof o.meta === "object" && "bytes" in o.meta
          ? Number((o.meta as { bytes: unknown }).bytes) || null
          : null,
    })),
  );

  const share = await activeShare(scene.id, env.APP_URL);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/dashboard"
        className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
      >
        ← Your scenes
      </Link>

      <header className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {scene.title}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {KIND_LABEL[scene.kind] ?? scene.kind}
          </p>
        </div>
        <span className="mt-1 shrink-0 rounded-full border border-neutral-300 px-3 py-1 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-700">
          {STATUS_LABEL[scene.status] ?? scene.status}
        </span>
      </header>

      {scene.description ? (
        <p className="mt-4 whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-400">
          {scene.description}
        </p>
      ) : null}

      {viewable.length > 0 ? (
        <SceneViewer sceneId={scene.id} outputs={viewable} />
      ) : null}

      <AssetUploader
        sceneId={scene.id}
        initialAssets={assets.map(serializeAsset)}
        editable={editable}
      />

      <SharePanel
        sceneId={scene.id}
        initialShare={share}
        ready={scene.status === "READY" && viewable.length > 0}
      />

      <GeneratePanel
        sceneId={scene.id}
        initialState={genState}
        assetCount={assets.length}
      />
    </main>
  );
}
