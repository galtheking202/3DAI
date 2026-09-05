// No "server-only" marker: also imported by the standalone generation worker.
// Not reachable from client code.
import { Prisma, type SceneStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { GeneratorOutput } from "@/lib/generator";

export type EnqueueResult =
  | { ok: true }
  | { ok: false; code: number; error: string };

/**
 * Queue a generation run for a scene the user owns. Allowed from DRAFT (first
 * run) or FAILED (retry). Sets the scene to QUEUED and creates a PENDING job in
 * one transaction; refuses if a run is already active or there are no assets.
 */
export async function enqueueGeneration(
  sceneId: string,
  userId: string,
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
      data: { status: "QUEUED" },
    });
    return { ok: true };
  });
}

export type ClaimedJob = { id: string; sceneId: string; attempts: number };

/**
 * Atomically take up to `limit` oldest PENDING jobs and mark them RUNNING.
 * `FOR UPDATE SKIP LOCKED` lets multiple workers (and concurrent claims within
 * one worker) pull from the queue without stepping on each other. Returns an
 * empty array when the queue is empty.
 */
export async function claimNextJobs(limit: number): Promise<ClaimedJob[]> {
  return db.$queryRaw<ClaimedJob[]>`
    UPDATE "Job" AS j
    SET status = 'RUNNING',
        attempts = j.attempts + 1,
        "startedAt" = now(),
        "updatedAt" = now()
    WHERE j.id IN (
      SELECT id FROM "Job"
      WHERE status = 'PENDING' AND type = 'GENERATE_3D'
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    RETURNING j.id, j."sceneId", j.attempts;
  `;
}

export type PollableJob = {
  id: string;
  sceneId: string;
  attempts: number;
  providerRef: string;
};

/**
 * Atomically take up to `limit` RUNNING jobs due for another poll, bumping
 * each one's `nextPollAt` forward as a lease. The lease is what makes this
 * safe across worker replicas without an explicit "locked by" column: whoever
 * claims a job owns it until the lease elapses, and if that worker crashes
 * mid-poll, the job simply becomes claimable again once the lease expires —
 * no separate stale-job sweep needed for the polling phase.
 */
export async function claimJobsToPoll(limit: number): Promise<PollableJob[]> {
  const leaseSeconds = env.GENERATION_POLL_INTERVAL_MS / 1000;
  return db.$queryRaw<PollableJob[]>`
    UPDATE "Job" AS j
    SET "nextPollAt" = now() + make_interval(secs => ${leaseSeconds}),
        "updatedAt" = now()
    WHERE j.id IN (
      SELECT id FROM "Job"
      WHERE status = 'RUNNING'
        AND "providerRef" IS NOT NULL
        AND ("nextPollAt" IS NULL OR "nextPollAt" <= now())
      ORDER BY "nextPollAt" ASC NULLS FIRST
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    RETURNING j.id, j."sceneId", j.attempts, j."providerRef";
  `;
}

/** Record the handle returned by Generator3D.submit() and set its first poll lease. */
export async function recordSubmission(jobId: string, providerRef: string): Promise<void> {
  await db.job.update({
    where: { id: jobId },
    data: {
      providerRef,
      progress: 0,
      nextPollAt: new Date(Date.now() + env.GENERATION_POLL_INTERVAL_MS),
    },
  });
}

/** Record a progress update from a "running" poll result. */
export async function updateJobProgress(jobId: string, progress: number): Promise<void> {
  await db.job.update({ where: { id: jobId }, data: { progress } });
}

/** Jobs already submitted to the generator and not yet finished, across all workers. */
export async function countInFlightJobs(): Promise<number> {
  return db.job.count({ where: { status: "RUNNING", providerRef: { not: null } } });
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
        data: {
          status: "PENDING",
          error: err,
          startedAt: null,
          providerRef: null,
          progress: null,
          nextPollAt: null,
        },
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
        progress: number | null;
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
          progress: job.progress,
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
