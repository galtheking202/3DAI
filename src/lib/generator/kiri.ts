import { unzipSync } from "fflate";
import { env } from "@/lib/env";
import { outputKey, putObject } from "@/lib/storage";
import type {
  Generator3D,
  GeneratorContext,
  GeneratorInput,
  GeneratorOutput,
} from "./types";

const API_BASE = "https://api.kiriengine.app/api/v1/open";
const POLL_INTERVAL_MS = 10_000;
const MAX_WAIT_MS = 45 * 60_000; // photogrammetry is slow; fail a hung task here
const MAX_CONSECUTIVE_POLL_ERRORS = 5;

// KIRI's video scan wants <=1920x1080 and <=3 min. We can't check resolution or
// duration here, but a byte cap keeps a huge upload out of the worker's memory.
const MAX_VIDEO_BYTES = 300 * 1024 * 1024;
const MIN_IMAGES = 20;
const MAX_IMAGES = 300;

// getStatus: -1 uploading, 0 processing, 1 failed, 2 successful, 3 queuing, 4 expired
const STATUS_OK = 2;
const STATUS_FAILED = 1;
const STATUS_EXPIRED = 4;

type KiriEnvelope<T> = { code: number; msg: string; data: T; ok: boolean };
type CreateData = { serialize: string };
type StatusData = { serialize: string; status: number };
type ZipData = { serialize: string; modelUrl: string };

/** The worker maps an error message of exactly "aborted" to a clean requeue. */
function abortError(): Error {
  return new Error("aborted");
}

function mb(n: number): string {
  return `${Math.round(n / 1024 / 1024)} MB`;
}

/** A Node Buffer is a valid Blob part at runtime; the DOM lib types disagree
 *  (ArrayBufferLike vs ArrayBuffer), so bridge it here without a copy. */
function part(buf: Buffer): BlobPart {
  return buf as unknown as BlobPart;
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
 * KIRI Engine photogrammetry: a walkthrough video (or >=20 photos) of the real
 * object in, a *measured* textured GLB out. Unlike MeshyGenerator this is real
 * reconstruction rather than generation, so proportions are trustworthy and it
 * handles spaces and vehicles, not just single objects. `KIRI_MASK` strips the
 * background so the model is the object alone.
 *
 * Flow: upload the source file(s) as multipart -> poll getStatus -> getModelZip
 * -> download the zip, pull the .glb out of it, re-upload that under the scene's
 * outputs prefix (same contract as the other generators).
 *
 * The upload and poll run inside this single blocking call, so one worker is
 * tied up for the (often long) duration of a run — scale with more workers.
 * A retry after the KIRI task was created starts a fresh task and spends more
 * credits.
 */
export class KiriGenerator implements Generator3D {
  readonly name = "kiri";

  private auth(): Record<string, string> {
    if (!env.KIRI_API_KEY) {
      throw new Error("KIRI_API_KEY is required when GENERATOR=kiri");
    }
    return { Authorization: `Bearer ${env.KIRI_API_KEY}` };
  }

  async generate(
    input: GeneratorInput,
    ctx: GeneratorContext,
  ): Promise<GeneratorOutput[]> {
    const video = input.assets.find((a) => a.type === "VIDEO");
    const images = input.assets.filter((a) => a.type === "IMAGE");

    let serialize: string;
    let source: string;

    if (video) {
      if (video.sizeBytes > MAX_VIDEO_BYTES) {
        throw new Error(
          `KIRI video is ${mb(video.sizeBytes)}; keep it under ${mb(MAX_VIDEO_BYTES)} (needs <=1080p and <=3 min)`,
        );
      }
      ctx.log(`kiri: uploading video (${mb(video.sizeBytes)})`);
      const form = this.baseForm();
      const buf = await this.fetchBuffer(video.url, ctx.signal);
      form.append(
        "videoFile",
        new Blob([part(buf)], { type: video.mimeType || "video/mp4" }),
        "walkthrough.mp4",
      );
      serialize = await this.create(`${API_BASE}/photo/video`, form, ctx.signal);
      source = "video";
    } else if (images.length >= MIN_IMAGES) {
      const use = images.slice(0, MAX_IMAGES);
      ctx.log(`kiri: uploading ${use.length} image(s)`);
      const form = this.baseForm();
      let i = 0;
      for (const img of use) {
        if (ctx.signal.aborted) throw abortError();
        const buf = await this.fetchBuffer(img.url, ctx.signal);
        form.append(
          "imagesFiles",
          new Blob([part(buf)], { type: img.mimeType || "image/jpeg" }),
          `img-${String(i++).padStart(3, "0")}`,
        );
      }
      serialize = await this.create(`${API_BASE}/photo/image`, form, ctx.signal);
      source = `${use.length} images`;
    } else {
      throw new Error(
        `KIRI needs a walkthrough video or at least ${MIN_IMAGES} photos; this scene has ${video ? 1 : 0} video and ${images.length} photo(s)`,
      );
    }

    ctx.log(`kiri: task ${serialize} created`);
    await this.poll(serialize, ctx);

    const modelUrl = await this.modelZipUrl(serialize, ctx.signal);
    ctx.log("kiri: downloading model zip");
    const zip = await this.fetchBuffer(modelUrl, ctx.signal);
    const glb = extractGlb(zip);

    const key = outputKey(input.sceneId, "glb");
    await putObject(key, glb, "model/gltf-binary");
    ctx.log(`kiri: wrote ${glb.length} bytes to ${key}`);

    return [
      {
        format: "GLB",
        storageKey: key,
        meta: {
          generator: "kiri",
          kiriSerialize: serialize,
          modelQuality: env.KIRI_MODEL_QUALITY,
          textureQuality: env.KIRI_TEXTURE_QUALITY,
          masked: env.KIRI_MASK,
          kind: input.kind,
          source,
          bytes: glb.length,
        },
      },
    ];
  }

  private baseForm(): FormData {
    const f = new FormData();
    f.append("modelQuality", env.KIRI_MODEL_QUALITY);
    f.append("textureQuality", env.KIRI_TEXTURE_QUALITY);
    f.append("fileFormat", "glb");
    f.append("isMask", env.KIRI_MASK ? "1" : "0");
    f.append("textureSmoothing", "0");
    return f;
  }

  private async create(
    url: string,
    form: FormData,
    signal: AbortSignal,
  ): Promise<string> {
    const data = await this.request<CreateData>(
      url,
      { method: "POST", headers: this.auth(), body: form },
      signal,
    );
    if (!data.serialize) throw new Error("KIRI create returned no serialize id");
    return data.serialize;
  }

  private async poll(serialize: string, ctx: GeneratorContext): Promise<void> {
    const url = `${API_BASE}/model/getStatus?serialize=${encodeURIComponent(serialize)}`;
    const deadline = Date.now() + MAX_WAIT_MS;
    let pollErrors = 0;
    let last = -99;

    while (Date.now() <= deadline) {
      if (ctx.signal.aborted) throw abortError();

      let data: StatusData;
      try {
        data = await this.request<StatusData>(url, { headers: this.auth() }, ctx.signal);
        pollErrors = 0;
      } catch (err) {
        if (ctx.signal.aborted) throw abortError();
        if (++pollErrors > MAX_CONSECUTIVE_POLL_ERRORS) throw err;
        ctx.log(
          `kiri: poll error ${pollErrors}/${MAX_CONSECUTIVE_POLL_ERRORS}, retrying`,
        );
        await sleep(POLL_INTERVAL_MS, ctx.signal);
        continue;
      }

      if (data.status !== last) {
        ctx.log(`kiri: status ${data.status}`);
        last = data.status;
      }
      if (data.status === STATUS_OK) return;
      if (data.status === STATUS_FAILED) {
        throw new Error("KIRI reconstruction failed");
      }
      if (data.status === STATUS_EXPIRED) {
        throw new Error("KIRI task expired before it was collected");
      }

      await sleep(POLL_INTERVAL_MS, ctx.signal);
    }
    throw new Error(
      `KIRI task ${serialize} did not finish within ${MAX_WAIT_MS / 60_000} min`,
    );
  }

  private async modelZipUrl(serialize: string, signal: AbortSignal): Promise<string> {
    const data = await this.request<ZipData>(
      `${API_BASE}/model/getModelZip?serialize=${encodeURIComponent(serialize)}`,
      { headers: this.auth() },
      signal,
    );
    if (!data.modelUrl) throw new Error("KIRI getModelZip returned no modelUrl");
    return data.modelUrl;
  }

  private async request<T>(
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
        `KIRI ${init.method ?? "GET"} ${url} -> ${res.status}: ${text.slice(0, 300)}`,
      );
    }
    let body: KiriEnvelope<T>;
    try {
      body = JSON.parse(text) as KiriEnvelope<T>;
    } catch {
      throw new Error(`KIRI ${url} returned non-JSON: ${text.slice(0, 200)}`);
    }
    if (body.ok === false || (typeof body.code === "number" && body.code !== 0)) {
      throw new Error(`KIRI error (${body.code}): ${body.msg || "no message"}`);
    }
    return body.data;
  }

  private async fetchBuffer(url: string, signal: AbortSignal): Promise<Buffer> {
    let res: Response;
    try {
      res = await fetch(url, { signal });
    } catch (err) {
      if (signal.aborted) throw abortError();
      throw err;
    }
    if (!res.ok) {
      throw new Error(`KIRI file fetch -> ${res.status}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
}

/** Pull the first `.glb` entry out of KIRI's result zip. */
function extractGlb(zip: Buffer): Buffer {
  const entries = unzipSync(new Uint8Array(zip));
  const name = Object.keys(entries).find((n) => n.toLowerCase().endsWith(".glb"));
  if (!name) {
    const listed = Object.keys(entries).slice(0, 10).join(", ") || "none";
    throw new Error(`KIRI zip has no .glb (entries: ${listed})`);
  }
  return Buffer.from(entries[name]);
}
