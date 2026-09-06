"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { sparkFileTypeFor, viewerKindFor, type ViewableOutput } from "@/lib/outputs";

const MeshCanvas = dynamic(() => import("./MeshCanvas"), { ssr: false });
const SplatCanvas = dynamic(() => import("./SplatCanvas"), { ssr: false });

type LoadState = "loading" | "ready" | "error";

const noop = () => {};

/**
 * Passive, non-interactive render of a scene's output for a dashboard card.
 * The canvas mounts only once scrolled near the viewport — a grid of cards
 * would otherwise open one live WebGL context per card at once, and browsers
 * cap how many can stay alive (see stage.ts).
 */
export default function ModelThumbnail({ output }: { output: ViewableOutput }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onReady = useCallback(() => setState("ready"), []);
  const onError = useCallback(() => setState("error"), []);

  const kind = viewerKindFor(output.format);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {visible ? (
        kind === "mesh" ? (
          <MeshCanvas
            url={output.url}
            sizeBytes={output.sizeBytes}
            onProgress={noop}
            onReady={onReady}
            onError={onError}
            resetSignal={0}
            interactive={false}
          />
        ) : (
          <SplatCanvas
            url={output.url}
            fileType={sparkFileTypeFor(output.format)}
            sizeBytes={output.sizeBytes}
            onProgress={noop}
            onReady={onReady}
            onError={onError}
            resetSignal={0}
            interactive={false}
          />
        )
      ) : null}

      {state !== "ready" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-neutral-100 dark:bg-neutral-900">
          {state === "error" ? (
            <span className="text-xs text-neutral-400">No preview</span>
          ) : (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-transparent dark:border-neutral-700" />
          )}
        </div>
      ) : null}
    </div>
  );
}
