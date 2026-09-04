"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { boundsOf, createStage, type Stage } from "./stage";

/**
 * glTF/GLB renderer. Lit with a generated room environment rather than an HDR
 * file so there is no second asset to fetch, and PBR materials (the sample
 * captures use sheen/clearcoat) still read correctly.
 */
export default function MeshCanvas({
  url,
  sizeBytes,
  onProgress,
  onReady,
  onError,
  resetSignal,
}: {
  url: string;
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
    const stage = createStage(container);
    stageRef.current = stage;

    // Image-based lighting from a procedural room — no network fetch.
    const pmrem = new THREE.PMREMGenerator(stage.renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    stage.scene.environment = envRT.texture;

    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        if (cancelled) return;
        stage.scene.add(gltf.scene);
        stage.frame(boundsOf(gltf.scene));
        onReady();
      },
      (event) => {
        if (cancelled) return;
        const total = event.total || sizeBytes || 0;
        if (total > 0) onProgress(Math.min(event.loaded / total, 1));
      },
      (err) => {
        if (cancelled) return;
        onError(err instanceof Error ? err.message : "Could not load the model");
      },
    );

    return () => {
      cancelled = true;
      envRT.dispose();
      pmrem.dispose();
      stage.dispose();
      stageRef.current = null;
    };
    // `url` identifies the output; the callbacks are stable from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Parent's "Reset view" button bumps a counter rather than reaching in.
  useEffect(() => {
    if (resetSignal > 0) stageRef.current?.reset();
  }, [resetSignal]);

  return <div ref={containerRef} className="h-full w-full" />;
}
