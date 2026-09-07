"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FILE_INPUT_ACCEPT,
  MAX_ASSETS_PER_SCENE,
  checkFile,
  formatBytes,
  resolveMime,
  type SceneAsset,
} from "@/lib/upload";

const MAX_CONCURRENT = 3;

type Pending = {
  id: string;
  name: string;
  size: number;
  progress: number; // 0..1
  status: "uploading" | "error";
  error?: string;
};

let counter = 0;
const localId = () => `u${Date.now()}_${counter++}`;

/** PUT a file to a presigned URL, reporting progress. */
function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Storage rejected the upload (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

export default function AssetUploader({
  sceneId,
  initialAssets,
  editable,
}: {
  sceneId: string;
  initialAssets: SceneAsset[];
  editable: boolean;
}) {
  const router = useRouter();
  const [assets, setAssets] = useState<SceneAsset[]>(initialAssets);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const total = assets.length + pending.filter((p) => p.status === "uploading").length;
  const remaining = MAX_ASSETS_PER_SCENE - total;

  const patchPending = useCallback(
    (id: string, patch: Partial<Pending>) =>
      setPending((cur) => cur.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    [],
  );
  const dropPending = useCallback(
    (id: string) => setPending((cur) => cur.filter((p) => p.id !== id)),
    [],
  );

  const uploadOne = useCallback(
    async (entry: Pending, file: File, contentType: string) => {
      try {
        const presignRes = await fetch(`/api/scenes/${sceneId}/assets/presign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType,
            sizeBytes: file.size,
          }),
        });
        if (!presignRes.ok) {
          throw new Error((await presignRes.json().catch(() => null))?.error ?? "Could not start upload");
        }
        const { key, uploadUrl } = (await presignRes.json()) as {
          key: string;
          uploadUrl: string;
        };

        await putWithProgress(uploadUrl, file, contentType, (f) =>
          patchPending(entry.id, { progress: f }),
        );

        const confirmRes = await fetch(`/api/scenes/${sceneId}/assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key,
            filename: file.name,
            contentType,
            sizeBytes: file.size,
          }),
        });
        if (!confirmRes.ok) {
          throw new Error((await confirmRes.json().catch(() => null))?.error ?? "Could not save file");
        }
        const { asset } = (await confirmRes.json()) as { asset: SceneAsset };
        setAssets((cur) =>
          cur.some((a) => a.id === asset.id) ? cur : [...cur, asset],
        );
        dropPending(entry.id);
        // Re-run the server render so GeneratePanel sees the new asset count
        // (its "Generate 3D" button is disabled while the scene has no files).
        router.refresh();
      } catch (err) {
        patchPending(entry.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Upload failed",
        });
      }
    },
    [sceneId, patchPending, dropPending, router],
  );

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      let slots = MAX_ASSETS_PER_SCENE - total;
      const accepted: { entry: Pending; file: File; contentType: string }[] = [];
      const rejected: Pending[] = [];

      for (const file of files) {
        const contentType = resolveMime(file.name, file.type);
        const problem = checkFile({ type: contentType, size: file.size });
        if (problem) {
          rejected.push({
            id: localId(),
            name: file.name,
            size: file.size,
            progress: 0,
            status: "error",
            error: problem,
          });
          continue;
        }
        if (slots <= 0) {
          rejected.push({
            id: localId(),
            name: file.name,
            size: file.size,
            progress: 0,
            status: "error",
            error: `Scene is full (${MAX_ASSETS_PER_SCENE} files max)`,
          });
          continue;
        }
        slots -= 1;
        accepted.push({
          entry: {
            id: localId(),
            name: file.name,
            size: file.size,
            progress: 0,
            status: "uploading",
          },
          file,
          contentType,
        });
      }

      setPending((cur) => [...cur, ...rejected, ...accepted.map((a) => a.entry)]);

      // Simple concurrency-limited queue.
      let cursor = 0;
      const runNext = async (): Promise<void> => {
        const next = accepted[cursor++];
        if (!next) return;
        await uploadOne(next.entry, next.file, next.contentType);
        return runNext();
      };
      for (let i = 0; i < Math.min(MAX_CONCURRENT, accepted.length); i++) {
        void runNext();
      }
    },
    [total, uploadOne],
  );

  const removeAsset = useCallback(
    async (assetId: string) => {
      const snapshot = assets;
      setAssets((cur) => cur.filter((a) => a.id !== assetId));
      const res = await fetch(`/api/scenes/${sceneId}/assets/${assetId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 404) {
        setAssets(snapshot); // put it back
        return;
      }
      // Keep the server render (and GeneratePanel's asset count) in sync.
      router.refresh();
    },
    [assets, sceneId, router],
  );

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-500">
          Files
        </h2>
        <span className="text-xs text-neutral-500">
          {total} / {MAX_ASSETS_PER_SCENE}
        </span>
      </div>

      {editable ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
          }}
          className={`mt-3 rounded-lg border border-dashed px-6 py-10 text-center transition-colors ${
            dragging
              ? "border-neutral-900 bg-neutral-50 dark:border-neutral-200 dark:bg-neutral-900"
              : "border-neutral-300 dark:border-neutral-700"
          }`}
        >
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Drag a walkthrough video and photos here, or{" "}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={remaining <= 0}
              className="font-medium text-neutral-900 underline underline-offset-2 disabled:opacity-40 dark:text-neutral-100"
            >
              choose files
            </button>
            .
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            MP4 / MOV / WebM video, JPEG / PNG / WebP / HEIC images.
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={FILE_INPUT_ACCEPT}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        <p className="mt-3 text-sm text-neutral-500">
          This scene is locked for processing — files can no longer be changed.
        </p>
      )}

      <ul className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-800">
        {assets.map((a, i) => (
          <li key={a.id} className="flex items-center gap-3 py-3 text-sm">
            <span className="w-8 shrink-0 text-xs tabular-nums text-neutral-400">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {a.type === "VIDEO" ? "Video" : "Image"}
              <span className="ml-2 text-xs text-neutral-400">{a.mimeType}</span>
            </span>
            <span className="shrink-0 text-xs text-neutral-500">
              {formatBytes(a.sizeBytes)}
            </span>
            {editable ? (
              <button
                type="button"
                onClick={() => removeAsset(a.id)}
                className="shrink-0 text-xs text-neutral-500 hover:text-red-600"
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}

        {pending.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-3 text-sm">
            <span className="w-12 shrink-0 text-xs uppercase tracking-wide text-neutral-400">
              {p.status === "error" ? "—" : `${Math.round(p.progress * 100)}%`}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {p.name}
              {p.status === "error" ? (
                <span className="ml-2 text-red-600 dark:text-red-400">{p.error}</span>
              ) : null}
            </span>
            <span className="shrink-0 text-xs text-neutral-500">
              {formatBytes(p.size)}
            </span>
            <button
              type="button"
              onClick={() => dropPending(p.id)}
              className="shrink-0 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
            >
              Dismiss
            </button>
          </li>
        ))}
      </ul>

      {assets.length === 0 && pending.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">No files yet.</p>
      ) : null}
    </section>
  );
}
