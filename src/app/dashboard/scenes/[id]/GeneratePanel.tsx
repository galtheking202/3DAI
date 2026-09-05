"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GenerationState } from "@/lib/jobs";
import CopyShareLink from "@/components/CopyShareLink";

const POLL_MS = 2000;
const ACTIVE = new Set(["QUEUED", "PROCESSING"]);

function Spinner() {
  return (
    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
  );
}

export default function GeneratePanel({
  sceneId,
  initialState,
  assetCount,
  shareUrl,
}: {
  sceneId: string;
  initialState: GenerationState;
  assetCount: number;
  /** Existing share link, if the scene already has one. */
  shareUrl: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<GenerationState>(initialState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => {
    if (!ACTIVE.has(state.status)) {
      stopPolling();
      return;
    }
    if (timer.current) return;
    timer.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/scenes/${sceneId}/status`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const next = (await res.json()) as GenerationState;
        setState(next);
        if (!ACTIVE.has(next.status)) {
          stopPolling();
          router.refresh();
        }
      } catch {
        // transient; try again on the next tick
      }
    }, POLL_MS);
    return stopPolling;
  }, [state.status, sceneId, router, stopPolling]);

  const generate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/scenes/${sceneId}/generate`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!res.ok) {
        setError(body?.error ?? "Could not start generation");
        return;
      }
      setState((s) => ({ ...s, status: "QUEUED" }));
    } finally {
      setBusy(false);
    }
  }, [sceneId]);

  const btn =
    "rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200";

  if (state.status === "DRAFT") {
    return (
      <Wrap>
        <button
          type="button"
          onClick={generate}
          disabled={busy || assetCount === 0}
          className={btn}
        >
          {busy ? "Starting…" : "Generate 3D"}
        </button>
        <p className="mt-2 text-xs text-neutral-400">
          {assetCount === 0
            ? "Add at least one file to enable generation."
            : "Runs on the mock engine — it returns a sample model rather than reconstructing your upload."}
        </p>
        {error ? <Err>{error}</Err> : null}
      </Wrap>
    );
  }

  if (state.status === "QUEUED" || state.status === "PROCESSING") {
    const attempt = state.job?.attempts ?? 1;
    const progress = state.job?.progress ?? null;
    return (
      <Wrap>
        <p className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          <Spinner />
          {state.status === "QUEUED"
            ? "Queued — waiting for a worker…"
            : progress !== null
              ? `Processing… ${progress}%`
              : "Processing…"}
          {attempt > 1 ? (
            <span className="text-xs text-neutral-400">attempt {attempt}</span>
          ) : null}
        </p>
        <p className="mt-2 text-xs text-neutral-400">
          This page updates automatically. Make sure the worker is running
          (`npm run worker`).
        </p>
      </Wrap>
    );
  }

  if (state.status === "READY") {
    return (
      <Wrap>
        <p className="text-sm font-medium text-green-700 dark:text-green-400">
          ✓ 3D scene ready
        </p>
        <ul className="mt-3 space-y-2">
          {state.outputs.map((o) => (
            <li key={o.id} className="flex items-center gap-3 text-sm">
              <span className="w-14 shrink-0 text-xs uppercase tracking-wide text-neutral-400">
                {o.format}
              </span>
              <a
                href={`/api/scenes/${sceneId}/outputs/${o.id}`}
                className="text-neutral-900 underline underline-offset-2 dark:text-neutral-100"
              >
                Download
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <CopyShareLink sceneId={sceneId} initialUrl={shareUrl} />
          <span className="text-xs text-neutral-400">
            Send this to a buyer — they can look around it without an account.
          </span>
        </div>
      </Wrap>
    );
  }

  // FAILED
  return (
    <Wrap>
      <p className="text-sm font-medium text-red-700 dark:text-red-400">
        Generation failed
      </p>
      {state.job?.error ? (
        <p className="mt-1 text-xs text-neutral-500">{state.job.error}</p>
      ) : null}
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className={`${btn} mt-3`}
      >
        {busy ? "Starting…" : "Try again"}
      </button>
      {error ? <Err>{error}</Err> : null}
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-10 border-t border-neutral-200 pt-6 dark:border-neutral-800">
      {children}
    </div>
  );
}

function Err({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-xs text-red-600 dark:text-red-400">{children}</p>;
}
