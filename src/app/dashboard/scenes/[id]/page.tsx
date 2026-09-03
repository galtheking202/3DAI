import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getOwnedScene, serializeAsset } from "@/lib/scenes";
import { generationState } from "@/lib/jobs";
import AssetUploader from "./AssetUploader";
import GeneratePanel from "./GeneratePanel";

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

      <AssetUploader
        sceneId={scene.id}
        initialAssets={assets.map(serializeAsset)}
        editable={editable}
      />

      <GeneratePanel
        sceneId={scene.id}
        initialState={genState}
        assetCount={assets.length}
      />
    </main>
  );
}
