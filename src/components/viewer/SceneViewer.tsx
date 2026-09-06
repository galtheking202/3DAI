"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import CopyShareLink from "@/components/CopyShareLink";
import {
  OUTPUT_LABEL,
  sparkFileTypeFor,
  viewerKindFor,
  type ViewableOutput,
} from "@/lib/outputs";

// Three.js and Spark are large and only needed once a scene is READY, so they
// stay out of the dashboard bundle and off the server render entirely.
const MeshCanvas = dynamic(() => import("./MeshCanvas"), { ssr: false });
const SplatCanvas = dynamic(() => import("./SplatCanvas"), { ssr: false });

type LoadState =
  | { phase: "loading"; progress: number }
  | { phase: "ready" }
  | { phase: "error"; message: string };

export default function SceneViewer({
  sceneId,
  outputs,
  allowDownload = true,
  fill = false,
  share = null,
}: {
  sceneId: string;
  outputs: ViewableOutput[];
  /**
   * Off for share-link visitors: they are being shown an item, not handed the
   * asset. The model still reaches their browser to be rendered at all, so this
   * removes the obvious affordance rather than protecting the bytes.
   */
  allowDownload?: boolean;
  /**
   * Fill the parent flex column instead of a fixed aspect ratio — the share
   * page uses this so the whole view fits one screen with nothing to scroll.
   */
  fill?: boolean;
  /** Owner-only quick-share button next to Download. Omit for share-link visitors. */
  share?: { initialUrl: string | null } | null;
}) {
  const [activeId, setActiveId] = useState(outputs[0]?.id ?? "");
  const [state, setState] = useState<LoadState>({ phase: "loading", progress: 0 });
  const [resetSignal, setResetSignal] = useState(0);

  const active = useMemo(
    () => outputs.find((o) => o.id === activeId) ?? outputs[0],
    [outputs, activeId],
  );

  const onProgress = useCallback((progress: number) => {
    setState((s) => (s.phase === "loading" ? { phase: "loading", progress } : s));
  }, []);
  const onReady = useCallback(() => setState({ phase: "ready" }), []);
  const onError = useCallback(
    (message: string) => setState({ phase: "error", message }),
    [],
  );

  const select = useCallback((id: string) => {
    setActiveId(id);
    setState({ phase: "loading", progress: 0 });
  }, []);

  if (!active) return null;

  const kind = viewerKindFor(active.format);
  // Remount the canvas when the chosen output changes so the old GL context is
  // disposed rather than reused for a different renderer.
  const canvasKey = active.id;

  return (
    <section
      className={
        fill
          ? "mt-4 flex min-h-0 flex-1 flex-col"
          : "mt-10 border-t border-neutral-200 pt-6 dark:border-neutral-800"
      }
    >
      <div className="flex shrink-0 items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-500">
          3D view
        </h2>
        <div className="flex items-center gap-3 text-xs">
          {state.phase === "ready" ? (
            <button
              type="button"
              onClick={() => setResetSignal((n) => n + 1)}
              className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
            >
              Reset view
            </button>
          ) : null}
          {allowDownload ? (
            <a
              href={`/api/scenes/${sceneId}/outputs/${active.id}`}
              aria-label="Download"
              title="Download"
              className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
            >
              ⬇️
            </a>
          ) : null}
          {share ? (
            <CopyShareLink sceneId={sceneId} initialUrl={share.initialUrl} iconOnly />
          ) : null}
        </div>
      </div>

      {outputs.length > 1 ? (
        <div className="mt-3 flex shrink-0 flex-wrap gap-2">
          {outputs.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => select(o.id)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                o.id === active.id
                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                  : "border-neutral-300 text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
              }`}
            >
              {OUTPUT_LABEL[o.format]}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className={
          fill
            ? "relative mt-3 w-full min-h-0 flex-1 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
            : "relative mt-3 aspect-[4/3] w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 sm:aspect-video dark:border-neutral-800 dark:bg-neutral-900"
        }
      >
        {kind === "mesh" ? (
          <MeshCanvas
            key={canvasKey}
            url={active.url}
            sizeBytes={active.sizeBytes}
            onProgress={onProgress}
            onReady={onReady}
            onError={onError}
            resetSignal={resetSignal}
          />
        ) : (
          <SplatCanvas
            key={canvasKey}
            url={active.url}
            fileType={sparkFileTypeFor(active.format)}
            sizeBytes={active.sizeBytes}
            onProgress={onProgress}
            onReady={onReady}
            onError={onError}
            resetSignal={resetSignal}
          />
        )}

        {state.phase === "loading" ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-100/80 backdrop-blur-sm dark:bg-neutral-900/80">
            <div className="h-1 w-40 overflow-hidden rounded-full bg-neutral-300 dark:bg-neutral-700">
              <div
                className="h-full bg-neutral-900 transition-[width] duration-150 dark:bg-neutral-100"
                style={{ width: `${Math.round(state.progress * 100)}%` }}
              />
            </div>
            <p className="text-xs text-neutral-500">
              {state.progress > 0
                ? `Loading ${OUTPUT_LABEL[active.format]} — ${Math.round(state.progress * 100)}%`
                : `Loading ${OUTPUT_LABEL[active.format]}…`}
            </p>
          </div>
        ) : null}

        {state.phase === "error" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              Could not display this output
            </p>
            <p className="text-xs text-neutral-500">{state.message}</p>
          </div>
        ) : null}
      </div>

      <p className="mt-2 shrink-0 text-xs text-neutral-400">
        Drag to orbit · scroll or pinch to zoom · two fingers or right-drag to pan
      </p>
    </section>
  );
}
