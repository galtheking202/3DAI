import type { AssetType, OutputFormat, SceneKind } from "@prisma/client";

/** One source file for a generation run, with a presigned URL to fetch it. */
export type GeneratorAsset = {
  type: AssetType;
  mimeType: string;
  storageKey: string;
  /** Size of the stored object in bytes. */
  sizeBytes: number;
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

/**
 * Throw this from a generator when retrying cannot help or would cost money
 * (bad input, or a paid task the provider has already rejected). The worker
 * fails the job outright instead of requeueing it.
 */
export class PermanentError extends Error {
  readonly permanent = true;
}

export function isPermanentError(err: unknown): boolean {
  return (err as { permanent?: unknown } | null)?.permanent === true;
}

/**
 * The single seam between the app and whatever actually builds the 3D scene.
 * `MockGenerator` today, `AtlasGenerator` once World Labs Atlas is available —
 * nothing else in the pipeline changes when that swap happens.
 */
export interface Generator3D {
  readonly name: string;
  generate(
    input: GeneratorInput,
    ctx: GeneratorContext,
  ): Promise<GeneratorOutput[]>;
}
