"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AVATAR_INPUT_ACCEPT, checkAvatarFile, resolveMime } from "@/lib/upload";

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M5.5 19c0-3.31 2.91-5.5 6.5-5.5s6.5 2.19 6.5 5.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * The account control in the dashboard header: a round avatar button that opens
 * a small menu to change the user's photo or sign out. Sign-out is a plain form
 * post so it still works with JS disabled.
 */
export default function UserMenu({
  email,
  imageUrl,
}: {
  email: string;
  /** Short-lived presigned URL for the current avatar, or null. */
  imageUrl: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<string | null>(imageUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The server hands us a fresh presigned URL on every refresh — take it.
  useEffect(() => setImage(imageUrl), [imageUrl]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      const contentType = resolveMime(file.name, file.type);
      const problem = checkAvatarFile({ type: contentType, size: file.size });
      if (problem) {
        setError(problem);
        return;
      }

      setBusy(true);
      try {
        const presignRes = await fetch("/api/me/avatar/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType,
            sizeBytes: file.size,
          }),
        });
        if (!presignRes.ok) {
          throw new Error(
            (await presignRes.json().catch(() => null))?.error ??
              "Could not start the upload",
          );
        }
        const { key, uploadUrl } = (await presignRes.json()) as {
          key: string;
          uploadUrl: string;
        };

        const put = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: file,
        });
        if (!put.ok) {
          throw new Error(`Storage rejected the upload (${put.status})`);
        }

        const confirmRes = await fetch("/api/me/avatar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key }),
        });
        if (!confirmRes.ok) {
          throw new Error(
            (await confirmRes.json().catch(() => null))?.error ??
              "Could not save the image",
          );
        }
        const { imageUrl: nextUrl } = (await confirmRes.json()) as {
          imageUrl: string;
        };
        setImage(nextUrl);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  const remove = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/me/avatar", { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        throw new Error("Could not remove the image");
      }
      setImage(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }, [router]);

  const itemClass =
    "block w-full px-3 py-2 text-left hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-neutral-900";

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-neutral-300 bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800"
      >
        {image ? (
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <PersonIcon className="h-5 w-5" />
        )}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-2 w-56 overflow-hidden rounded-lg border border-neutral-200 bg-white text-sm text-neutral-700 shadow-lg dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
        >
          <p className="truncate border-b border-neutral-200 px-3 py-2 text-xs text-neutral-500 dark:border-neutral-800">
            {email}
          </p>

          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className={itemClass}
          >
            {busy ? "Working…" : image ? "Change photo" : "Upload photo"}
          </button>

          {image ? (
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={remove}
              className={itemClass}
            >
              Remove photo
            </button>
          ) : null}

          {error ? (
            <p className="px-3 py-2 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          <form
            method="post"
            action="/api/auth/logout"
            className="border-t border-neutral-200 dark:border-neutral-800"
          >
            <button type="submit" role="menuitem" className={itemClass}>
              Sign out
            </button>
          </form>
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={AVATAR_INPUT_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
    </div>
  );
}
