// No "server-only" marker: this module is also imported by the standalone
// generation worker (a plain Node process, not a React build). It is never
// reachable from client code — it pulls in the AWS SDK and node:crypto.
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Single S3-compatible client. Points at local MinIO in dev and Cloudflare R2 in
 * production — the only differences are endpoint/credentials/path-style, all from
 * env. Nothing else in the app talks to storage directly.
 */
export const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
  // Keep presigned PUT URLs clean: the default ("WHEN_SUPPORTED") bakes
  // x-amz-checksum-* into the signature, which then forces the browser to send
  // matching headers. R2 and some S3 setups reject the mismatch.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const UPLOAD_URL_TTL_SECONDS = 10 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 60 * 60;

/**
 * Storage key for a scene asset. The random segment makes keys unguessable and
 * lets us presign an upload before the Asset row exists. `filename` only
 * contributes a sanitized extension so downloads keep a sensible suffix.
 */
export function assetKey(sceneId: string, filename: string): string {
  const ext = (filename.match(/\.[a-z0-9]{1,8}$/i)?.[0] ?? "").toLowerCase();
  return `scenes/${sceneId}/assets/${randomBytes(16).toString("hex")}${ext}`;
}

/** True when `key` belongs to the given scene's asset prefix. */
export function keyBelongsToScene(key: string, sceneId: string): boolean {
  return key.startsWith(`scenes/${sceneId}/assets/`);
}

/** Storage key for a generated output (worker writes these). */
export function outputKey(sceneId: string, ext: string): string {
  return `scenes/${sceneId}/outputs/${randomBytes(16).toString("hex")}.${ext}`;
}

/** Upload a buffer we already hold in memory (used by the generation worker). */
export async function putObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** Presigned PUT the browser uses to upload one file directly to storage. */
export function presignUpload(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  );
}

/** Presigned GET for reading an object back (viewer / worker download). */
export function presignDownload(key: string): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), {
    expiresIn: DOWNLOAD_URL_TTL_SECONDS,
  });
}

/** Object metadata, or null if it does not exist. */
export async function headObject(
  key: string,
): Promise<{ sizeBytes: number; contentType: string | null } | null> {
  try {
    const res = await s3.send(
      new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
    );
    return {
      sizeBytes: res.ContentLength ?? 0,
      contentType: res.ContentType ?? null,
    };
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata
      ?.httpStatusCode;
    if (status === 404 || (err as { name?: string }).name === "NotFound") return null;
    throw err;
  }
}

/** Best-effort delete; a missing object is not an error. */
export async function deleteObject(key: string): Promise<void> {
  await s3
    .send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }))
    .catch(() => {});
}
