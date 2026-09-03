import { env } from "@/lib/env";
import { outputKey, putObject } from "@/lib/storage";
import { sampleGlb } from "./sample";
import type {
  Generator3D,
  GeneratorContext,
  GeneratorInput,
  GeneratorOutput,
} from "./types";

/** Resolve after `ms`, or reject early if the signal aborts. */
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error("aborted"));
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Stand-in engine: waits a realistic beat, then "produces" a bundled sample GLB
 * by uploading it under the scene's outputs prefix. Swapping in Atlas means
 * replacing this class, nothing else.
 */
export class MockGenerator implements Generator3D {
  readonly name = "mock";

  async generate(
    input: GeneratorInput,
    ctx: GeneratorContext,
  ): Promise<GeneratorOutput[]> {
    const spread = Math.max(0, env.MOCK_GENERATOR_MAX_MS - env.MOCK_GENERATOR_MIN_MS);
    const ms = env.MOCK_GENERATOR_MIN_MS + Math.floor(Math.random() * (spread + 1));
    ctx.log(`mock: simulating generation for ~${ms}ms from ${input.assets.length} asset(s)`);
    await delay(ms, ctx.signal);

    const glb = sampleGlb();
    const key = outputKey(input.sceneId, "glb");
    await putObject(key, glb, "model/gltf-binary");
    ctx.log(`mock: wrote ${glb.length} bytes to ${key}`);

    return [
      {
        format: "GLB",
        storageKey: key,
        meta: {
          generator: "mock",
          kind: input.kind,
          sourceAssetCount: input.assets.length,
          bytes: glb.length,
          simulatedMs: ms,
        },
      },
    ];
  }
}
