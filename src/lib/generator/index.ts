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
export {
  SELECTABLE_GENERATORS,
  GENERATOR_LABEL,
  isSelectableGenerator,
  type SelectableGenerator,
} from "./names";

const cache = new Map<string, Generator3D>();

function build(name: string): Generator3D {
  switch (name) {
    case "atlas":
      return new AtlasGenerator();
    case "meshy":
      return new MeshyGenerator();
    case "kiri":
      return new KiriGenerator();
    default:
      return new MockGenerator();
  }
}

/**
 * The generator for `name`, or the `GENERATOR` env default when `name` is
 * missing or unknown. Instances are stateless, so they're memoized per name for
 * the life of the process.
 */
export function getGenerator(name?: string | null): Generator3D {
  const key =
    name === "mock" ||
    name === "atlas" ||
    name === "meshy" ||
    name === "kiri"
      ? name
      : env.GENERATOR;
  let g = cache.get(key);
  if (!g) {
    g = build(key);
    cache.set(key, g);
  }
  return g;
}
