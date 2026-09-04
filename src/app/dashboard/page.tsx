import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import CopyShareLink from "@/components/CopyShareLink";

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
    },
  });

  const appUrl = env.APP_URL.replace(/\/$/, "");
  const shareUrlFor = (links: { slug: string; expiresAt: Date | null }[]) => {
    const link = links[0];
    if (!link) return null;
    if (link.expiresAt && link.expiresAt < new Date()) return null;
    return `${appUrl}/s/${link.slug}`;
  };

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
        <ul className="mt-8 divide-y divide-neutral-200 dark:divide-neutral-800">
          {scenes.map((scene) => (
            <li key={scene.id} className="flex items-center gap-3 py-3">
              <Link
                href={`/dashboard/scenes/${scene.id}`}
                className="flex min-w-0 flex-1 items-center justify-between gap-3 hover:opacity-70"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">{scene.title}</span>
                  <span className="ml-2 text-xs text-neutral-500">
                    {scene._count.assets}{" "}
                    {scene._count.assets === 1 ? "file" : "files"}
                  </span>
                </span>
                <span className="shrink-0 text-xs uppercase tracking-wide text-neutral-500">
                  {STATUS_LABEL[scene.status] ?? scene.status}
                </span>
              </Link>
              {scene.status === "READY" ? (
                <CopyShareLink
                  sceneId={scene.id}
                  initialUrl={shareUrlFor(scene.shareLinks)}
                  compact
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
