/**
 * Upload rules shared by the client uploader and the server routes that presign
 * and confirm. Keep this file free of server-only imports.
 */
import type { AssetType } from "@prisma/client";

/** An Asset as sent to the browser (BigInt size narrowed to number, dates as ISO). */
export type SceneAsset = {
  id: string;
  type: AssetType;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  position: number;
  createdAt: string;
};

export const MAX_VIDEO_BYTES = 750 * 1024 * 1024; // 750 MB
export const MAX_IMAGE_BYTES = 30 * 1024 * 1024; // 30 MB
export const MAX_ASSETS_PER_SCENE = 60;

export const ACCEPTED_VIDEO_MIME = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export const ACCEPTED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const ACCEPTED_MIME = [
  ...ACCEPTED_VIDEO_MIME,
  ...ACCEPTED_IMAGE_MIME,
] as const;

/** `accept` attribute for a file input. */
export const FILE_INPUT_ACCEPT = ACCEPTED_MIME.join(",");

const EXT_TO_MIME: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  qt: "video/quicktime",
  webm: "video/webm",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

/**
 * Browsers sometimes hand us a blank `file.type` (common for .mov and .heic).
 * Fall back to the extension so those still upload.
 */
export function resolveMime(name: string, providedType: string): string {
  if (providedType) return providedType;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[ext] ?? "";
}

/** Asset category for a mime type, or null when the type is not allowed. */
export function assetTypeForMime(mime: string): AssetType | null {
  if ((ACCEPTED_VIDEO_MIME as readonly string[]).includes(mime)) return "VIDEO";
  if ((ACCEPTED_IMAGE_MIME as readonly string[]).includes(mime)) return "IMAGE";
  return null;
}

/** Largest allowed size in bytes for an asset category. */
export function maxBytesForType(type: AssetType): number {
  return type === "VIDEO" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

/**
 * Validate a file's type and size before we bother presigning. Returns an error
 * string, or null when the file is acceptable.
 */
export function checkFile(file: { type: string; size: number }): string | null {
  const type = assetTypeForMime(file.type);
  if (!type) return "Unsupported file type";
  const max = maxBytesForType(type);
  if (file.size <= 0) return "File is empty";
  if (file.size > max) return `Too large (max ${formatBytes(max)})`;
  return null;
}
