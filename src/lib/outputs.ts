/**
 * Output-format metadata shared by the server (scene page) and the client
 * viewer. Keep this file free of server-only imports.
 */
import type { OutputFormat } from "@prisma/client";

/** Which renderer an output needs. `mesh` = glTF, `splat` = Gaussian splat. */
export type ViewerKind = "mesh" | "splat";

export const OUTPUT_LABEL: Record<OutputFormat, string> = {
  GLB: "glTF mesh",
  SPLAT: "Splat",
  SPZ: "Splat (SPZ)",
  SOG: "Splat (SOG)",
};

const VIEWER_KIND: Record<OutputFormat, ViewerKind> = {
  GLB: "mesh",
  SPLAT: "splat",
  SPZ: "splat",
  SOG: "splat",
};

export function viewerKindFor(format: OutputFormat): ViewerKind {
  return VIEWER_KIND[format];
}

/**
 * Spark's own file-type tag for a splat format. Spark calls the SOG family
 * "pcsogs"; ours is the zipped bundle. Meshes are not Spark's concern.
 */
const SPARK_FILE_TYPE: Partial<Record<OutputFormat, string>> = {
  SPLAT: "splat",
  SPZ: "spz",
  SOG: "pcsogszip",
};

export function sparkFileTypeFor(format: OutputFormat): string | undefined {
  return SPARK_FILE_TYPE[format];
}

/** File extension used for storage keys and downloads. */
export const OUTPUT_EXT: Record<OutputFormat, string> = {
  GLB: "glb",
  SPLAT: "splat",
  SPZ: "spz",
  SOG: "sog",
};

export const OUTPUT_MIME: Record<OutputFormat, string> = {
  GLB: "model/gltf-binary",
  SPLAT: "application/octet-stream",
  SPZ: "application/octet-stream",
  SOG: "application/octet-stream",
};

/** One viewable artifact, as handed from the scene page to the viewer. */
export type ViewableOutput = {
  id: string;
  format: OutputFormat;
  /** Short-lived presigned GET URL. */
  url: string;
  /** Bytes, when storage reported a size — drives the load progress bar. */
  sizeBytes: number | null;
};
