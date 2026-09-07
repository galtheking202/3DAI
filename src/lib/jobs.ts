// No "server-only" marker: also imported by the standalone generation worker.
// Not reachable from client code.
import { Prisma, type SceneStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { GeneratorOutput } from "@/lib/generator";
import { isSelectableGenerator } from "@/lib/generator/names";

export type EnqueueResult =
  | { ok: true }
  | { ok: false; code: number; error: string };

/**
 * Queue a generation run for a scene the user owns. Allowed from DRAFT (first
 * run) or FAILED (retry). Sets the scene to QUEUED and creates a PENDING job in
 * one transaction; refuses if a run is already active or there are no assets.
 *
 * `engine`, when a recognised name, is recorded on the scene and used by the
 * worker for this and future runs; when omitted the scene keeps its previous
 * choice (or the `GENERATOR` env default).
 */
export async function enqueueGeneration(
  sceneId: string,
  userId: string,
  engine?: string | null,
): Promise<EnqueueResult> {
  return db.$transaction(async (tx) => {
    const scene = await tx.scene.findFirst({
      where: { id: sceneId, ownerId: userId },
    });
    if (!scene) return { ok: false, code: 404, error: "Scene not found" };
    if (scene.status !== "DRAFT" && scene.status !== "FAILED") {
      return {
        ok: false,
        code: 409,
        error: `Scene is already ${scene.status.toLowerCase()}`,
      };
    }

    const assetCount = await tx.asset.count({ where: { sceneId } });
    if (assetCount === 0) {
      return { ok: false, code: 409, error: "Add at least one file first" };
    }

    const active = await tx.job.count({
      where: { sceneId, status: { in: ["PENDING", "RUNNING"] } },
    });
    if (active > 0) {
      return { ok: false, code: 409, error: "Generation is already running" };
    }

    await tx.job.create({
      data: { sceneId, type: "GENERATE_3D", status: "PENDING" },
    });
    await tx.scene.update({
      where: { id: sceneId },
      data: {
        status: "QUEUED",
        ...(isSelectableGenerator(engine) ? { generator: engine } : {}),
      },
    });
    return { ok: true };
  });
}

export type ClaimedJob = { id: string; sceneId: string; attempts: number };

/**
 * Atomically take the oldest PENDING job and mark it RUNNING. `FOR UPDATE SKIP
 * LOCKED` lets multiple workers pull from the queue without stepping on each
 * other. Returns null when the queue is empty.
 */
export async function claimNextJob(): Promise<ClaimedJob | null> {
  const rows = await db.$queryRaw<ClaimedJob[]>`
    UPDATE "Job" AS j
    SET status = 'RUNNING',
        attempts = j.attempts + 1,
        "startedAt" = now(),
        "updatedAt" = now()
    WHERE j.id = (
      SELECT id FROM "Job"
      WHERE status = 'PENDING' AND type = 'GENERATE_3D'
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING j.id, j."sceneId", j.attempts;
  `;
  return rows[0] ?? null;
}

/** Move a claimed job's scene from QUEUED to PROCESSING (no-op if it moved on). */
export async function markSceneProcessing(sceneId: string): Promise<void> {
  await db.scene.updateMany({
    where: { id: sceneId, status: "QUEUED" },
    data: { status: "PROCESSING" },
  });
}

/** Record outputs, mark the job SUCCEEDED and the scene READY. */
export async function completeJob(
  jobId: string,
  sceneId: string,
  outputs: GeneratorOutput[],
): Promise<void> {
  await db.$transaction([
    db.sceneOutput.createMany({
      data: outputs.map((o) => ({
        sceneId,
        format: o.format,
        storageKey: o.storageKey,
        meta:
          o.meta === undefined
            ? Prisma.JsonNull
            : (o.meta as Prisma.InputJsonValue),
      })),
    }),
    db.job.update({
      where: { id: jobId },
      data: { status: "SUCCEEDED", error: null, finishedAt: new Date() },
    }),
    db.scene.update({ where: { id: sceneId }, data: { status: "READY" } }),
  ]);
}

/**
 * Handle a failed run. Below the attempt cap the job goes back to PENDING (scene
 * returns to QUEUED) for another pass; at the cap both go terminal FAILED.
 * Returns whether it will be retried.
 */
export async function failJob(
  jobId: string,
  sceneId: string,
  attempts: number,
  message: string,
): Promise<boolean> {
  const willRetry = attempts < env.WORKER_MAX_ATTEMPTS;
  const err = message.slice(0, 1000);

  if (willRetry) {
    await db.$transaction([
      db.job.update({
        where: { id: jobId },
        data: { status: "PENDING", error: err, startedAt: null },
      }),
      db.scene.updateMany({
        where: { id: sceneId, status: { in: ["QUEUED", "PROCESSING"] } },
        data: { status: "QUEUED" },
      }),
    ]);
  } else {
    await db.$transaction([
      db.job.update({
        where: { id: jobId },
        data: { status: "FAILED", error: err, finishedAt: new Date() },
      }),
      db.scene.updateMany({
        where: { id: sceneId },
        data: { status: "FAILED" },
      }),
    ]);
  }
  return willRetry;
}

export type GenerationState = {
  status: SceneStatus;
  job:
    | {
        status: string;
        attempts: number;
        error: string | null;
        startedAt: string | null;
        finishedAt: string | null;
      }
    | null;
  outputs: { id: string; format: string; createdAt: string }[];
};

/** Snapshot used by the scene page and the status-poll endpoint. */
export async function generationState(
  sceneId: string,
): Promise<GenerationState | null> {
  const scene = await db.scene.findUnique({
    where: { id: sceneId },
    include: {
      jobs: { orderBy: { createdAt: "desc" }, take: 1 },
      outputs: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!scene) return null;

  const job = scene.jobs[0];
  return {
    status: scene.status,
    job: job
      ? {
          status: job.status,
          attempts: job.attempts,
          error: job.error,
          startedAt: job.startedAt?.toISOString() ?? null,
          finishedAt: job.finishedAt?.toISOString() ?? null,
        }
      : null,
    outputs: scene.outputs.map((o) => ({
      id: o.id,
      format: o.format,
      createdAt: o.createdAt.toISOString(),
    })),
  };
}
