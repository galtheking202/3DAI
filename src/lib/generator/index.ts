import { env } from "@/lib/env";
import { MockGenerator } from "./mock";
import { AtlasGenerator } from "./atlas";
import type { Generator3D } from "./types";

export type {
  Generator3D,
  GeneratorAsset,
  GeneratorContext,
  GeneratorInput,
  GeneratorOutput,
} from "./types";

let instance: Generator3D | null = null;

/** The generator selected by `GENERATOR` env, memoized for the process. */
export function getGenerator(): Generator3D {
  if (instance) return instance;
  instance = env.GENERATOR === "atlas" ? new AtlasGenerator() : new MockGenerator();
  return instance;
}
