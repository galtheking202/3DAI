/**
 * Inspect or apply the object-storage CORS policy.
 *
 *   npm run cors                  # print the bucket's current rules
 *   npm run cors -- --apply       # write the rules this app needs
 *
 * Why this exists: the browser talks to object storage directly — presigned
 * PUTs when uploading a capture, presigned GETs when the viewer streams a
 * model. Both are cross-origin from the app. MinIO allows that by default, so
 * local dev works with no configuration and the problem only shows up in
 * production, where R2 denies cross-origin reads unless a policy says otherwise.
 * The symptom is an upload or viewer that fails with no useful error, because
 * the browser blocks the response before any JS sees it.
 *
 * Origins are taken from APP_URL plus localhost for dev. Run it against a
 * given environment's variables, e.g. `railway run --service web -- ...`.
 */
import {
  GetBucketCorsCommand,
  PutBucketCorsCommand,
  type CORSRule,
} from "@aws-sdk/client-s3";
import { s3 } from "@/lib/storage";
import { env } from "@/lib/env";

const origins = Array.from(
  new Set([env.APP_URL.replace(/\/$/, ""), "http://localhost:3000"]),
);

const rules: CORSRule[] = [
  {
    AllowedOrigins: origins,
    // GET/HEAD for the viewer and downloads; PUT for presigned direct uploads.
    AllowedMethods: ["GET", "HEAD", "PUT"],
    // The presigned PUT sends Content-Type; range requests send Range.
    AllowedHeaders: ["*"],
    // Content-Length drives the viewer's progress bar; Content-Range is needed
    // for the ranged fetches Spark uses to stream a splat.
    ExposeHeaders: ["Content-Length", "Content-Range", "Content-Type", "ETag"],
    MaxAgeSeconds: 3600,
  },
];

async function current(): Promise<CORSRule[] | null> {
  try {
    const res = await s3.send(
      new GetBucketCorsCommand({ Bucket: env.S3_BUCKET }),
    );
    return res.CORSRules ?? [];
  } catch (err) {
    const name = (err as { name?: string }).name ?? "";
    if (/NoSuchCORSConfiguration|NotImplemented|NoSuchBucket/.test(name)) return null;
    throw err;
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`bucket ${env.S3_BUCKET} @ ${env.S3_ENDPOINT}`);

  const existing = await current();
  console.log(
    existing === null
      ? "current: no CORS configuration"
      : `current: ${JSON.stringify(existing, null, 2)}`,
  );

  if (!apply) {
    console.log(`\nwould apply for origins: ${origins.join(", ")}`);
    console.log("re-run with --apply to write it");
    return;
  }

  await s3.send(
    new PutBucketCorsCommand({
      Bucket: env.S3_BUCKET,
      CORSConfiguration: { CORSRules: rules },
    }),
  );
  console.log(`\napplied: ${JSON.stringify(await current(), null, 2)}`);
}

main().catch((err) => {
  console.error("cors failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
