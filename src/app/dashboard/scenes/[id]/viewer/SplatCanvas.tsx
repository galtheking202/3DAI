"use client";

import { useEffect, useRef } from "react";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import { createStage, type Stage } from "./stage";

/**
 * Gaussian-splat renderer (Spark, WebGL2 — so it runs on iOS/Android without a
 * WebGPU gate). Splats are display-referred and sort-bound, so the stage runs
 * with tone mapping and MSAA off; see StageOptions.
 */
export default function SplatCanvas({
  url,
  fileType,
  sizeBytes,
  onProgress,
  onReady,
  onError,
  resetSignal,
}: {
  url: string;
  /** Spark's own format tag ("spz", "splat", "pcsogszip"). */
  fileType?: string;
  sizeBytes: number | null;
  onProgress: (fraction: number) => void;
  onReady: () => void;
  onError: (message: string) => void;
  resetSignal: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    const stage = createStage(container, { antialias: false, toneMapping: false });
    stageRef.current = stage;

    // SparkRenderer is itself a THREE.Mesh: adding it to the scene is what
    // drives splat accumulation, via its onBeforeRender.
    const spark = new SparkRenderer({ renderer: stage.renderer });
    stage.scene.add(spark);

    const mesh = new SplatMesh({
      url,
      // Spark sniffs the extension otherwise; our storage keys are opaque
      // hashes, so tell it explicitly.
      fileType: fileType as never,
      onProgress: (event: ProgressEvent) => {
        if (cancelled) return;
        const total = event.total || sizeBytes || 0;
        if (total > 0) onProgress(Math.min(event.loaded / total, 1));
      },
    });

    mesh.initialized
      .then(() => {
        if (cancelled) return;
        stage.scene.add(mesh);
        // Centres only: splat extents include long low-opacity tails that
        // would otherwise frame the model far too small.
        stage.frame(mesh.getBoundingBox(true));
        onReady();
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        onError(err instanceof Error ? err.message : "Could not load the splat");
      });

    return () => {
      cancelled = true;
      mesh.dispose();
      stage.dispose();
      stageRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, fileType]);

  useEffect(() => {
    if (resetSignal > 0) stageRef.current?.reset();
  }, [resetSignal]);

  return <div ref={containerRef} className="h-full w-full" />;
}
