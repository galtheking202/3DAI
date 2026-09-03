import type {
  Generator3D,
  GeneratorContext,
  GeneratorInput,
  GeneratorOutput,
} from "./types";

/**
 * Placeholder for the World Labs Atlas engine. Kept so the wiring and env switch
 * exist now; `generate` throws until the API is available and implemented.
 */
export class AtlasGenerator implements Generator3D {
  readonly name = "atlas";

  async generate(
    _input: GeneratorInput,
    _ctx: GeneratorContext,
  ): Promise<GeneratorOutput[]> {
    throw new Error(
      "AtlasGenerator is not implemented yet — set GENERATOR=mock until Atlas is available.",
    );
  }
}
