import type {
  Generator3D,
  GeneratorContext,
  GeneratorInput,
  PollResult,
  ProviderRef,
} from "./types";

const NOT_IMPLEMENTED =
  "AtlasGenerator is not implemented yet — set GENERATOR=mock until a hosted engine is wired up.";

/**
 * Placeholder for a hosted 3D-generation engine. Kept so the wiring and env
 * switch exist now; both methods throw until a real provider is implemented.
 */
export class AtlasGenerator implements Generator3D {
  readonly name = "atlas";

  async submit(_input: GeneratorInput, _ctx: GeneratorContext): Promise<ProviderRef> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async poll(_ref: ProviderRef, _ctx: GeneratorContext): Promise<PollResult> {
    throw new Error(NOT_IMPLEMENTED);
  }
}
