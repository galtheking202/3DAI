"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GenerationState } from "@/lib/jobs";
import {
  SELECTABLE_GENERATORS,
  GENERATOR_LABEL,
  isSelectableGenerator,
} from "@/lib/generator/names";
import CopyShareLink from "@/components/CopyShareLink";

const POLL_MS = 2000;
const ACTIVE = new Set(["QUEUED", "PROCESSING"]);

const ENGINE_HINT: Record<string, string> = {
  mock: "Returns a bundled sample, not a reconstruction of your upload.",
  meshy: "Generates a mesh from up to 4 photos — fast, best for single objects.",
  kiri: "Reconstructs from a walkthrough video or 20+ photos — slower, measured.",
};

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
  generator,
  defaultGenerator,
}: {
  sceneId: string;
  initialState: GenerationState;
  assetCount: number;
  /** Existing share link, if the scene already has one. */
  shareUrl: string | null;
  /** Engine already chosen for this scene, or null. */
  generator: string | null;
  /** `GENERATOR` env value — used when the scene hasn't chosen one. */
  defaultGenerator: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<GenerationState>(initialState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState(
    isSelectableGenerator(generator)
      ? generator
      : isSelectableGenerator(defaultGenerator)
        ? defaultGenerator
        : "mock",
  );
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engine }),
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
  }, [sceneId, engine]);

  const btn =
    "rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200";

  const picker = (
    <label className="block text-xs text-neutral-500">
      Engine
      <select
        value={engine}
        onChange={(e) => {
          if (isSelectableGenerator(e.target.value)) setEngine(e.target.value);
        }}
        disabled={busy}
        className="mt-1 block w-full max-w-xs rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      >
        {SELECTABLE_GENERATORS.map((g) => (
          <option key={g} value={g}>
            {GENERATOR_LABEL[g] + (g === defaultGenerator ? " · default" : "")}
          </option>
        ))}
      </select>
    </label>
  );

  if (state.status === "DRAFT") {
    return (
      <Wrap>
        {picker}
        <button
          type="button"
          onClick={generate}
          disabled={busy || assetCount === 0}
          className={`${btn} mt-3`}
        >
          {busy ? "Starting…" : "Generate 3D"}
        </button>
        <p className="mt-2 text-xs text-neutral-400">
          {assetCount === 0
            ? "Add at least one file to enable generation."
            : (ENGINE_HINT[engine] ?? "")}
        </p>
        {error ? <Err>{error}</Err> : null}
      </Wrap>
    );
  }

  if (state.status === "QUEUED" || state.status === "PROCESSING") {
    const attempt = state.job?.attempts ?? 1;
    return (
      <Wrap>
        <p className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          <Spinner />
          {state.status === "QUEUED"
            ? "Queued — waiting for a worker…"
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
        <p className="mt-1 mb-3 text-xs text-neutral-500">{state.job.error}</p>
      ) : null}
      {picker}
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
