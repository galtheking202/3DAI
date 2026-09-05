import { env } from "@/lib/env";
import { outputKey, putObject } from "@/lib/storage";
import { sampleGlb } from "./sample";
import type {
  Generator3D,
  GeneratorContext,
  GeneratorInput,
  PollResult,
  ProviderRef,
} from "./types";

type MockHandle = {
  sceneId: string;
  kind: string;
  assetCount: number;
  startedAt: number;
  finishAt: number;
};

function encode(handle: MockHandle): ProviderRef {
  return Buffer.from(JSON.stringify(handle)).toString("base64url");
}

function decode(ref: ProviderRef): MockHandle {
  return JSON.parse(Buffer.from(ref, "base64url").toString("utf8")) as MockHandle;
}

/**
 * Stand-in engine: encodes a random-length "run" into the handle itself
 * (start/finish timestamps) instead of keeping in-memory state, so it behaves
 * like a real hosted API from the worker's point of view — poll() is stateless
 * and safe to call from any process, including after a worker restart.
 */
export class MockGenerator implements Generator3D {
  readonly name = "mock";

  async submit(input: GeneratorInput, ctx: GeneratorContext): Promise<ProviderRef> {
    const spread = Math.max(0, env.MOCK_GENERATOR_MAX_MS - env.MOCK_GENERATOR_MIN_MS);
    const ms = env.MOCK_GENERATOR_MIN_MS + Math.floor(Math.random() * (spread + 1));
    ctx.log(`mock: simulating generation for ~${ms}ms from ${input.assets.length} asset(s)`);
    const now = Date.now();
    return encode({
      sceneId: input.sceneId,
      kind: input.kind,
      assetCount: input.assets.length,
      startedAt: now,
      finishAt: now + ms,
    });
  }

  async poll(ref: ProviderRef, ctx: GeneratorContext): Promise<PollResult> {
    const handle = decode(ref);
    const now = Date.now();
    if (now < handle.finishAt) {
      const total = handle.finishAt - handle.startedAt;
      const progress =
        total <= 0 ? 0 : Math.min(99, Math.floor(((now - handle.startedAt) / total) * 100));
      return { status: "running", progress };
    }

    const glb = sampleGlb();
    const key = outputKey(handle.sceneId, "glb");
    await putObject(key, glb, "model/gltf-binary");
    ctx.log(`mock: wrote ${glb.length} bytes to ${key}`);

    return {
      status: "succeeded",
      outputs: [
        {
          format: "GLB",
          storageKey: key,
          meta: {
            generator: "mock",
            kind: handle.kind,
            sourceAssetCount: handle.assetCount,
            bytes: glb.length,
          },
        },
      ],
    };
  }
}
