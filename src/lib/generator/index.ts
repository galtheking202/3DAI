import { env } from "@/lib/env";
import { MockGenerator } from "./mock";
import { AtlasGenerator } from "./atlas";
import { MeshyGenerator } from "./meshy";
import { KiriGenerator } from "./kiri";
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
  switch (env.GENERATOR) {
    case "atlas":
      instance = new AtlasGenerator();
      break;
    case "meshy":
      instance = new MeshyGenerator();
      break;
    case "kiri":
      instance = new KiriGenerator();
      break;
    default:
      instance = new MockGenerator();
  }
  return instance;
}
