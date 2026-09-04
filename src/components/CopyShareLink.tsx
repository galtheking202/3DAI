"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { ShareState } from "@/lib/share";

/** Defaults used when the button has to mint a link on the spot. */
const DEFAULT_EXPIRY_DAYS = 30;

/**
 * One-click "copy the share link" for places that aren't the full share panel:
 * the dashboard list and the just-finished state on the scene page.
 *
 * If the scene has no link yet the first click creates one (30 days, no
 * password) and copies it, so the common case is a single click. Anything more
 * involved — password, different expiry, revoke — lives in SharePanel.
 */
export default function CopyShareLink({
  sceneId,
  initialUrl,
  compact = false,
}: {
  sceneId: string;
  /** Existing link, when the caller already knows it. */
  initialUrl: string | null;
  /** Tighter styling for dense rows like the dashboard list. */
  compact?: boolean;
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

      {error ? (
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
      ) : null}
    </span>
  );
}
