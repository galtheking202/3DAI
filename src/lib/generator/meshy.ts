import { env } from "@/lib/env";
import { outputKey, putObject } from "@/lib/storage";
import type {
  Generator3D,
  GeneratorContext,
  GeneratorInput,
  GeneratorOutput,
} from "./types";

const API_BASE = "https://api.meshy.ai/openapi/v1";
const POLL_INTERVAL_MS = 5_000;
const MAX_WAIT_MS = 20 * 60_000; // fail the job if a task hangs past this
const MAX_CONSECUTIVE_POLL_ERRORS = 5;

/** Meshy's multi-image endpoint documents JPEG/PNG only for `image_urls`.
 *  The uploader also takes WebP and HEIC — neither goes to Meshy. */
const OK_IMAGE_MIME = new Set(["image/jpeg", "image/png"]);

type CreateResponse = { result: string };

type TaskResponse = {
  id: string;
  status: string; // PENDING | IN_PROGRESS | SUCCEEDED | FAILED | CANCELED | EXPIRED
  progress: number;
  model_urls?: { glb?: string };
  texture_urls?: unknown[];
  task_error?: { message?: string } | null;
};

/** The worker maps an error message of exactly "aborted" to a clean requeue. */
function abortError(): Error {
  return new Error("aborted");
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Meshy "multi-image to 3D": up to four photos of one object in, a textured GLB
 * out. Generative rather than photogrammetric — the images steer geometry and
 * texture, the model invents the rest — so it suits SceneKind OBJECT and not
 * whole APARTMENT / VEHICLE captures.
 *
 * Flow mirrors MockGenerator: create the task, poll it, then download
 * `model_urls.glb` and re-upload it under the scene's outputs prefix.
 *
 * Note on retries: a job that fails after the task was created has already spent
 * Meshy credits; the retry starts a fresh task and spends more.
 */
export class MeshyGenerator implements Generator3D {
  readonly name = "meshy";

  private headers(): Record<string, string> {
    if (!env.MESHY_API_KEY) {
      throw new Error("MESHY_API_KEY is required when GENERATOR=meshy");
    }
    return {
      Authorization: `Bearer ${env.MESHY_API_KEY}`,
      "Content-Type": "application/json",
    };
  }

  async generate(
    input: GeneratorInput,
    ctx: GeneratorContext,
  ): Promise<GeneratorOutput[]> {
    const images = input.assets
      .filter((a) => a.type === "IMAGE" && OK_IMAGE_MIME.has(a.mimeType))
      .slice(0, 4)
      .map((a) => a.url);

    if (images.length === 0) {
      throw new Error(
        "Meshy multi-image needs 1-4 JPEG or PNG photos of the object; this scene has none (WebP and HEIC are not accepted)",
      );
    }

    const body = {
      image_urls: images,
      ai_model: env.MESHY_AI_MODEL,
      should_texture: true,
      enable_pbr: true,
      texture_resolution: env.MESHY_TEXTURE_RESOLUTION,
      target_formats: ["glb"],
    };

    ctx.log(
      `meshy: creating multi-image task — ${images.length} image(s), ${env.MESHY_AI_MODEL}, ${env.MESHY_TEXTURE_RESOLUTION}`,
    );
    const created = await this.fetchJson<CreateResponse>(
      `${API_BASE}/multi-image-to-3d`,
      { method: "POST", headers: this.headers(), body: JSON.stringify(body) },
      ctx.signal,
    );
    const taskId = created.result;
    ctx.log(`meshy: task ${taskId} queued`);

    const task = await this.poll(taskId, ctx);
    const glbUrl = task.model_urls?.glb;
    if (!glbUrl) {
      throw new Error("Meshy task succeeded but returned no GLB URL");
    }

    ctx.log("meshy: downloading GLB");
    const glb = await this.download(glbUrl, ctx.signal);

    const key = outputKey(input.sceneId, "glb");
    await putObject(key, glb, "model/gltf-binary");
    ctx.log(`meshy: wrote ${glb.length} bytes to ${key}`);

    return [
      {
        format: "GLB",
        storageKey: key,
        meta: {
          generator: "meshy",
          meshyTaskId: taskId,
          aiModel: env.MESHY_AI_MODEL,
          textureResolution: env.MESHY_TEXTURE_RESOLUTION,
          pbr: true,
          kind: input.kind,
          sourceImageCount: images.length,
          bytes: glb.length,
        },
      },
    ];
  }

  private async poll(
    taskId: string,
    ctx: GeneratorContext,
  ): Promise<TaskResponse> {
    const url = `${API_BASE}/multi-image-to-3d/${taskId}`;
    const deadline = Date.now() + MAX_WAIT_MS;
    let pollErrors = 0;
    let lastProgress = -1;

    while (Date.now() <= deadline) {
      if (ctx.signal.aborted) throw abortError();

      let task: TaskResponse;
      try {
        task = await this.fetchJson<TaskResponse>(
          url,
          { headers: this.headers() },
          ctx.signal,
        );
        pollErrors = 0;
      } catch (err) {
        if (ctx.signal.aborted) throw abortError();
        if (++pollErrors > MAX_CONSECUTIVE_POLL_ERRORS) throw err;
        ctx.log(
          `meshy: poll error ${pollErrors}/${MAX_CONSECUTIVE_POLL_ERRORS}, retrying`,
        );
        await sleep(POLL_INTERVAL_MS, ctx.signal);
        continue;
      }

      if (task.progress !== lastProgress) {
        ctx.log(`meshy: ${task.status} ${task.progress}%`);
        lastProgress = task.progress;
      }

      if (task.status === "SUCCEEDED") return task;
      if (task.status !== "PENDING" && task.status !== "IN_PROGRESS") {
        throw new Error(
          `Meshy task ${task.status}: ${task.task_error?.message ?? "no detail"}`,
        );
      }

      await sleep(POLL_INTERVAL_MS, ctx.signal);
    }

    throw new Error(
      `Meshy task ${taskId} did not finish within ${MAX_WAIT_MS / 60_000} min`,
    );
  }

  private async fetchJson<T>(
    url: string,
    init: RequestInit,
    signal: AbortSignal,
  ): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal });
    } catch (err) {
      if (signal.aborted) throw abortError();
      throw err;
    }
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `Meshy ${init.method ?? "GET"} ${url} -> ${res.status}: ${text.slice(0, 300)}`,
      );
    }
    return JSON.parse(text) as T;
  }

  private async download(url: string, signal: AbortSignal): Promise<Buffer> {
    let res: Response;
    try {
      res = await fetch(url, { signal });
    } catch (err) {
      if (signal.aborted) throw abortError();
      throw err;
    }
    if (!res.ok) throw new Error(`Meshy GLB download -> ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}
