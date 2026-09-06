"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { ShareState } from "@/lib/share";

/** Defaults used when the button has to mint a link on the spot. */
const DEFAULT_EXPIRY_DAYS = 30;

/**
 * One-click "copy the share link", used in the dashboard list and (with the
 * link shown next to the button) under a ready scene's 3D viewer.
 *
 * If the scene has no link yet the first click creates one (30 days, no
 * password) and copies it, so the common case is a single click. Anything more
 * involved — password, different expiry, revoke — is API-only for now
 * (`POST`/`DELETE /api/scenes/[id]/share`); there's no UI for it.
 */
export default function CopyShareLink({
  sceneId,
  initialUrl,
  compact = false,
  showLink = false,
}: {
  sceneId: string;
  /** Existing link, when the caller already knows it. */
  initialUrl: string | null;
  /** Tighter styling for dense rows like the dashboard list. */
  compact?: boolean;
  /** Show the link itself next to the button (the ready scene's viewer). */
  showLink?: boolean;
}) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      let target = url;

      if (!target) {
        const res = await fetch(`/api/scenes/${sceneId}/share`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expiresInDays: DEFAULT_EXPIRY_DAYS,
            password: null,
          }),
        });
        const body = (await res.json().catch(() => null)) as
          | { share?: ShareState; error?: string }
          | null;
        if (!res.ok || !body?.share) {
          setError(body?.error ?? "Could not create a link");
          return;
        }
        target = body.share.url;
        setUrl(target);
        // Other views of the same scene (the share panel, the dashboard row)
        // render from server state, so pull them back in sync.
        router.refresh();
      }

      await navigator.clipboard.writeText(target);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be refused (insecure origin, denied permission);
      // the link still exists, so show it rather than losing the work.
      setError("Couldn't copy automatically");
    } finally {
      setBusy(false);
    }
  }, [sceneId, url, router]);

  const label = busy
    ? "Copying…"
    : copied
      ? "Copied"
      : url
        ? "Copy link"
        : "Copy share link";

  const errorNote = error ? (
    <span className="text-xs text-red-600 dark:text-red-400">
      {error}
      {url ? (
        <>
          {" — "}
          <a href={url} className="underline underline-offset-2">
            open it
          </a>
        </>
      ) : null}
    </span>
  ) : null;

  if (showLink) {
    return (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={copy}
          disabled={busy}
          className="shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
        >
          {copied ? "✓ Copied" : label}
        </button>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1 truncate text-xs text-neutral-500 underline decoration-neutral-300 underline-offset-2 hover:text-neutral-900 dark:decoration-neutral-700 dark:hover:text-neutral-200"
          >
            {url}
          </a>
        ) : (
          <span className="text-xs text-neutral-400">
            No link yet — the button makes one
          </span>
        )}
        {errorNote}
      </span>
    );
  }

  return (
    <span className={compact ? "shrink-0" : "inline-flex flex-col gap-1"}>
      <button
        type="button"
        onClick={copy}
        disabled={busy}
        className={
          compact
            ? "rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900"
            : "rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
        }
      >
        {copied ? "✓ Copied" : label}
      </button>

      {errorNote}
    </span>
  );
}
