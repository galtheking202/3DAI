/**
 * Seed realistic finished scenes: downloads a handful of small, permissively
 * licensed 3D models, uploads them to object storage under the same key layout
 * the worker uses, and writes the Scene / Asset / Job / SceneOutput rows a real
 * generation run would have produced.
 *
 *   npm run seed                          # local: upload + rows in one pass
 *   npm run seed -- --upload-only <file>  # upload to storage, emit a manifest
 *   npm run seed -- --db-only <file>      # write rows from a manifest
 *
 * The split exists because Railway's Postgres is only reachable from inside the
 * private network, while R2 is reachable from anywhere: the upload phase can run
 * against production storage locally, and the row-writing phase run wherever the
 * database happens to be reachable. Scene ids are minted up front so both phases
 * agree on the storage keys.
 *
 * Re-running replaces the seeded scenes (matched by title) and their storage
 * objects; scenes you made by hand are left alone.
 *
 * Model licences are recorded per entry below — all CC0 except the sofa
 * (CC BY 4.0, Wayfair) and the butterfly splat (Spark sample asset). Nothing
 * here is redistributed by the app; it is development seed data.
 */
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { db } from "@/lib/db";
import { deleteObject, putObject } from "@/lib/storage";
import { OUTPUT_EXT, OUTPUT_MIME } from "@/lib/outputs";
import type { OutputFormat, SceneKind } from "@prisma/client";

const KHRONOS =
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models";

type Seed = {
  title: string;
  description: string;
  kind: SceneKind;
  format: OutputFormat;
  url: string;
  /** Attribution recorded into SceneOutput.meta. */
  credit: string;
  /** How many stand-in source photos to record for the scene. */
  photos: number;
};

const SEEDS: Seed[] = [
  {
    title: "Velvet 3-seater sofa",
    description:
      "Living room set, barely used. Some sun fading on the left arm — visible in the capture.",
    kind: "OBJECT",
    format: "GLB",
    url: `${KHRONOS}/GlamVelvetSofa/glTF-Binary/GlamVelvetSofa.glb`,
    credit: "GlamVelvetSofa © 2021 Wayfair, LLC — CC BY 4.0",
    photos: 8,
  },
  {
    title: "Grandpa's armchair",
    description:
      "Solid oak frame, original upholstery. Walked around it twice with the phone.",
    kind: "OBJECT",
    format: "GLB",
    url: `${KHRONOS}/SheenChair/glTF-Binary/SheenChair.glb`,
    credit: "SheenChair © 2020 Wayfair, LLC — CC0 1.0",
    photos: 6,
  },
  {
    title: "1:18 die-cast model car",
    description: "Collector piece, boxed. Paint is mint, one wing mirror loose.",
    kind: "VEHICLE",
    format: "GLB",
    url: `${KHRONOS}/ToyCar/glTF-Binary/ToyCar.glb`,
    credit: "ToyCar © 2020 Guido Odendahl / Eric Chadwick — CC0 1.0",
    photos: 12,
  },
  {
    title: "Insulated steel flask",
    description: "Small object test — handheld capture, turntable style.",
    kind: "OBJECT",
    format: "GLB",
    url: `${KHRONOS}/WaterBottle/glTF-Binary/WaterBottle.glb`,
    credit: "WaterBottle © 2017 Microsoft — CC0 1.0",
    photos: 5,
  },
  {
    title: "Butterfly specimen (splat)",
    description:
      "Gaussian-splat capture — framed specimen, photographed from all sides.",
    kind: "OTHER",
    format: "SPZ",
    url: "https://sparkjs.dev/assets/splats/butterfly.spz",
    credit: "Butterfly sample asset — Spark (sparkjs.dev)",
    photos: 24,
  },
];

/** What the upload phase records for the row-writing phase. */
type Manifest = {
  createdAt: string;
  bucket: string;
  scenes: {
    sceneId: string;
    title: string;
    description: string;
    kind: SceneKind;
    format: OutputFormat;
    credit: string;
    source: string;
    outputKey: string;
    outputBytes: number;
    assets: { key: string; mimeType: string; sizeBytes: number }[];
  }[];
};

/* ------------------------------------------------------------------ */

/**
 * A cuid-shaped id. Prisma normally mints these via @default(cuid()), but the
 * upload phase needs the id before any row exists so storage keys can be built.
 */
function sceneId(): string {
  return `c${Date.now().toString(36)}${randomBytes(9).toString("hex")}`;
}

/** CRC-32, needed to emit valid PNG chunks. */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/**
 * A real (if boring) PNG, so the stand-in source photos are genuine objects in
 * storage — HEAD, size checks and deletes all behave as they would for a real
 * upload rather than against a zero-byte placeholder.
 */
function makePhoto(width: number, height: number, hue: number): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const t = x / width;
      raw[p++] = Math.round(120 + 90 * Math.sin(hue + t * 2));
      raw[p++] = Math.round(120 + 90 * Math.sin(hue + t * 2 + 2.1));
      raw[p++] = Math.round(120 + 90 * Math.sin(hue + t * 2 + 4.2));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ */

/** Download every model and push it, plus its stand-in photos, to storage. */
async function uploadPhase(): Promise<Manifest> {
  const manifest: Manifest = {
    createdAt: new Date().toISOString(),
    bucket: process.env.S3_BUCKET ?? "",
    scenes: [],
  };

  for (const [index, seed] of SEEDS.entries()) {
    const id = sceneId();

    const assets: Manifest["scenes"][number]["assets"] = [];
    for (let i = 0; i < seed.photos; i++) {
      const png = makePhoto(480, 360, index + i * 0.35);
      const key = `scenes/${id}/assets/${randomBytes(16).toString("hex")}.png`;
      await putObject(key, png, "image/png");
      assets.push({ key, mimeType: "image/png", sizeBytes: png.length });
    }

    const model = await download(seed.url);
    const key = `scenes/${id}/outputs/${randomBytes(16).toString("hex")}.${OUTPUT_EXT[seed.format]}`;
    await putObject(key, model, OUTPUT_MIME[seed.format]);

    manifest.scenes.push({
      sceneId: id,
      title: seed.title,
      description: seed.description,
      kind: seed.kind,
      format: seed.format,
      credit: seed.credit,
      source: seed.url,
      outputKey: key,
      outputBytes: model.length,
      assets,
    });

    console.log(
      `  ↑ ${seed.title} — ${seed.format} ${mb(model.length)} + ${seed.photos} photos → ${key}`,
    );
  }

  return manifest;
}

/** Write the Scene / Asset / Job / SceneOutput rows described by a manifest. */
async function dbPhase(manifest: Manifest): Promise<void> {
  const user = await db.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) {
    throw new Error(
      "No user in this database — sign in once through the app, then re-run.",
    );
  }
  console.log(`writing rows as ${user.email}`);

  const titles = manifest.scenes.map((s) => s.title);
  const stale = await db.scene.findMany({
    where: { ownerId: user.id, title: { in: titles } },
    include: { assets: true, outputs: true },
  });

  if (stale.length > 0) {
    console.log(`removing ${stale.length} previously seeded scene(s)`);
    for (const scene of stale) {
      for (const a of scene.assets) await deleteObject(a.storageKey);
      for (const o of scene.outputs) await deleteObject(o.storageKey);
    }
    await db.scene.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  }

  for (const entry of manifest.scenes) {
    await db.scene.create({
      data: {
        id: entry.sceneId,
        ownerId: user.id,
        title: entry.title,
        description: entry.description,
        kind: entry.kind,
        status: "READY",
        assets: {
          create: entry.assets.map((a, i) => ({
            type: "IMAGE" as const,
            storageKey: a.key,
            mimeType: a.mimeType,
            sizeBytes: BigInt(a.sizeBytes),
            position: i,
          })),
        },
        jobs: {
          create: {
            type: "GENERATE_3D" as const,
            status: "SUCCEEDED" as const,
            attempts: 1,
            startedAt: new Date(Date.now() - 1000 * 60 * 9),
            finishedAt: new Date(Date.now() - 1000 * 60 * 8),
          },
        },
        outputs: {
          create: {
            format: entry.format,
            storageKey: entry.outputKey,
            meta: {
              generator: "seed",
              kind: entry.kind,
              sourceAssetCount: entry.assets.length,
              bytes: entry.outputBytes,
              credit: entry.credit,
              source: entry.source,
            },
          },
        },
      },
    });
    console.log(`  ✓ ${entry.title}`);
  }
}

/* ------------------------------------------------------------------ */

async function main() {
  const argv = process.argv.slice(2);
  const uploadOnly = argv.indexOf("--upload-only");
  const dbOnly = argv.indexOf("--db-only");

  if (uploadOnly !== -1) {
    const out = argv[uploadOnly + 1];
    if (!out) throw new Error("--upload-only needs a manifest path");
    console.log(`uploading to bucket ${process.env.S3_BUCKET} @ ${process.env.S3_ENDPOINT}`);
    const manifest = await uploadPhase();
    writeFileSync(out, JSON.stringify(manifest, null, 2));
    console.log(`done — ${manifest.scenes.length} scenes uploaded, manifest at ${out}`);
    return;
  }

  if (dbOnly !== -1) {
    const file = argv[dbOnly + 1];
    if (!file) throw new Error("--db-only needs a manifest path");
    const manifest = JSON.parse(readFileSync(file, "utf8")) as Manifest;
    await dbPhase(manifest);
    console.log(`done — ${manifest.scenes.length} scenes written`);
    return;
  }

  const manifest = await uploadPhase();
  await dbPhase(manifest);
  console.log(`done — ${manifest.scenes.length} scenes seeded`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error("seed failed:", err instanceof Error ? err.message : err);
    await db.$disconnect();
    process.exit(1);
  });
