import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { presignDownload } from "@/lib/storage";
import type { ViewableOutput } from "@/lib/outputs";
import CopyShareLink from "@/components/CopyShareLink";
import ModelThumbnail from "@/components/viewer/ModelThumbnail";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  QUEUED: "Queued",
  PROCESSING: "Processing",
  READY: "Ready",
  FAILED: "Failed",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const scenes = await db.scene.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { assets: true } },
      // Newest live link per scene, so the row can copy it without a round trip.
      shareLinks: {
        where: { revokedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      // Just enough to render a card thumbnail — the scene page presigns the
      // rest when you open it.
      outputs: { orderBy: { createdAt: "asc" }, take: 1 },
    },
  });

  const appUrl = env.APP_URL.replace(/\/$/, "");
  const shareUrlFor = (links: { slug: string; expiresAt: Date | null }[]) => {
    const link = links[0];
    if (!link) return null;
    if (link.expiresAt && link.expiresAt < new Date()) return null;
    return `${appUrl}/s/${link.slug}`;
  };

  // One presigned URL per ready scene, for its card's live thumbnail.
  const thumbnails = new Map<string, ViewableOutput>();
  await Promise.all(
    scenes.map(async (scene) => {
      const output = scene.outputs[0];
      if (scene.status !== "READY" || !output) return;
      thumbnails.set(scene.id, {
        id: output.id,
        format: output.format,
        url: await presignDownload(output.storageKey),
        sizeBytes:
          output.meta && typeof output.meta === "object" && "bytes" in output.meta
            ? Number((output.meta as { bytes: unknown }).bytes) || null
            : null,
      });
    }),
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-neutral-500">
            3DAI
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Your scenes</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-neutral-500">{user.email}</span>
          <form method="post" action="/api/auth/logout">
            <button className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="mt-8">
        <Link
          href="/dashboard/new"
          className="inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          New scene
        </Link>
      </div>

      {scenes.length === 0 ? (
        <p className="mt-8 rounded-md border border-dashed border-neutral-300 px-4 py-10 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No scenes yet. Create one to upload a video and photos.
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-4">
          {scenes.map((scene) => {
            const thumbnail = thumbnails.get(scene.id);
            return (
              <li
                key={scene.id}
                className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800"
              >
                <Link
                  href={`/dashboard/scenes/${scene.id}`}
                  className="block hover:opacity-90"
                >
                  <div className="aspect-square bg-neutral-100 dark:bg-neutral-900">
                    {thumbnail ? (
                      <ModelThumbnail output={thumbnail} />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs uppercase tracking-wide text-neutral-400">
                        {STATUS_LABEL[scene.status] ?? scene.status}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium">{scene.title}</p>
                    <p className="mt-1 flex items-center justify-between text-xs text-neutral-500">
                      <span>
                        {scene._count.assets}{" "}
                        {scene._count.assets === 1 ? "file" : "files"}
                      </span>
                      <span className="uppercase tracking-wide">
                        {STATUS_LABEL[scene.status] ?? scene.status}
                      </span>
                    </p>
                  </div>
                </Link>
                {scene.status === "READY" ? (
                  <div className="px-3 pb-3">
                    <CopyShareLink
                      sceneId={scene.id}
                      initialUrl={shareUrlFor(scene.shareLinks)}
                      compact
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
