import type { AssetType, OutputFormat, SceneKind } from "@prisma/client";

/** One source file for a generation run, with a presigned URL to fetch it. */
export type GeneratorAsset = {
  type: AssetType;
  mimeType: string;
  storageKey: string;
  /** Time-limited GET URL for the object. */
  url: string;
};

export type GeneratorInput = {
  sceneId: string;
  kind: SceneKind;
  assets: GeneratorAsset[];
};

/** A finished artifact the generator has already uploaded to object storage. */
export type GeneratorOutput = {
  format: OutputFormat;
  storageKey: string;
  meta?: Record<string, unknown>;
};

export type GeneratorContext = {
  /** Aborted when the worker is shutting down; long steps should bail out. */
  signal: AbortSignal;
  /** Structured progress/log line, surfaced in the worker output. */
  log: (message: string) => void;
};

/** Opaque handle a hosted engine returns from submit(), used to poll it later. */
export type ProviderRef = string;

export type PollResult =
  | { status: "running"; progress?: number }
  | { status: "succeeded"; outputs: GeneratorOutput[] }
  | { status: "failed"; error: string };

/**
 * The single seam between the app and whatever actually builds the 3D scene.
 * Hosted engines are submit-then-poll over minutes, so the worker never blocks
 * on one call: `submit()` kicks a run off and returns a handle, `poll()` is
 * called again later (possibly by a different worker process/replica) to check
 * on it. `MockGenerator` simulates this by encoding a deadline into the handle
 * itself, so it needs no in-memory state and survives a worker restart.
 */
export interface Generator3D {
  readonly name: string;
  submit(input: GeneratorInput, ctx: GeneratorContext): Promise<ProviderRef>;
  poll(ref: ProviderRef, ctx: GeneratorContext): Promise<PollResult>;
}
