import type { Metadata } from "next";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { presignDownload, SHARE_URL_TTL_SECONDS } from "@/lib/storage";
import { resolveShare, unlockCookieName } from "@/lib/share";
import type { ViewableOutput } from "@/lib/outputs";
import SceneViewer from "@/components/viewer/SceneViewer";
import PasswordGate from "./PasswordGate";

// Every load re-checks the link, so a revoked or expired one dies immediately
// rather than being served from a cache.
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  OBJECT: "Object",
  APARTMENT: "Apartment / space",
  VEHICLE: "Vehicle",
  OTHER: "Item",
};

/**
 * Link previews. These links get pasted into messages and marketplace
 * listings, so an unfurl with a real title and description is the difference
 * between a click and a grey box.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const link = await db.shareLink.findUnique({
    where: { slug },
    include: { scene: true },
  });

  if (!link || link.revokedAt || (link.expiresAt && link.expiresAt < new Date())) {
    return { title: "Link unavailable — 3DAI", robots: { index: false } };
  }

  const title = `${link.scene.title} — 3D view`;
  const description =
    link.scene.description?.slice(0, 200) ||
    `Inspect this ${(KIND_LABEL[link.scene.kind] ?? "item").toLowerCase()} in 3D — move around it before you decide.`;

  return {
    title,
    description,
    // Unlisted links shouldn't turn up in search results.
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "website",
      url: `${env.APP_URL.replace(/\/$/, "")}/s/${slug}`,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const jar = await cookies();
  const resolved = await resolveShare(
    slug,
    jar.get(unlockCookieName(slug))?.value,
  );

  if (resolved.state === "missing") {
    return <Unavailable title="Link not found" body="This link doesn't exist." />;
  }
  if (resolved.state === "revoked") {
    return (
      <Unavailable
        title="Link revoked"
        body="The owner has turned this link off."
      />
    );
  }
  if (resolved.state === "expired") {
    return (
      <Unavailable
        title="Link expired"
        body="This link has passed its expiry date."
      />
    );
  }
  if (resolved.state === "locked") {
    return <PasswordGate slug={slug} wrongPassword={sp.error === "password"} />;
  }

  const scene = await db.scene.findUnique({
    where: { id: resolved.link.sceneId },
    include: { outputs: { orderBy: { createdAt: "asc" } } },
  });

  if (!scene || scene.outputs.length === 0) {
    return (
      <Unavailable
        title="Nothing to show yet"
        body="This capture hasn't finished processing."
      />
    );
  }

  // Short-lived URLs, minted per view: the share link itself can live for weeks,
  // but the object URLs behind it shouldn't outlast a viewing session.
  const outputs: ViewableOutput[] = await Promise.all(
    scene.outputs.map(async (o) => ({
      id: o.id,
      format: o.format,
      url: await presignDownload(o.storageKey, SHARE_URL_TTL_SECONDS),
      sizeBytes:
        o.meta && typeof o.meta === "object" && "bytes" in o.meta
          ? Number((o.meta as { bytes: unknown }).bytes) || null
          : null,
    })),
  );

  return (
    <main className="mx-auto flex h-dvh max-w-3xl flex-col overflow-hidden px-6 py-4">
      <header className="shrink-0">
        <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          {KIND_LABEL[scene.kind] ?? "Item"}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {scene.title}
        </h1>
        {scene.description ? (
          <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-sm text-neutral-600 dark:text-neutral-400">
            {scene.description}
          </p>
        ) : null}
      </header>

      <SceneViewer
        sceneId={scene.id}
        outputs={outputs}
        allowDownload={false}
        fill
      />

      <footer className="mt-2 shrink-0 text-center text-xs text-neutral-400">
        Shared with you via{" "}
        <a href="/" className="underline underline-offset-2">
          3DAI
        </a>
      </footer>
    </main>
  );
}

function Unavailable({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-neutral-500">
        3DAI
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{body}</p>
      <p className="mt-6 text-xs text-neutral-400">
        Ask whoever sent it for a new link.
      </p>
    </main>
  );
}
