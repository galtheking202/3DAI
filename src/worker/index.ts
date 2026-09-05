/**
 * Generation worker. Runs as its own process (`npm run worker`, or the Railway
 * `worker` service). Polls the Job queue, hands each run to the configured
 * Generator3D, and writes the outputs back.
 *
 * Design notes:
 * - Generation is submit-then-poll: `submitJob` hands a job to the generator
 *   once and records the handle it returns; `pollJob` is called again on later
 *   ticks (maybe by a different worker process) until the generator reports a
 *   terminal result. Neither call blocks the loop from tending to other jobs.
 * - Every claim (`claimNextJobs`, `claimJobsToPoll`) uses `FOR UPDATE SKIP
 *   LOCKED`, so running several workers is safe and just increases throughput.
 *   `claimJobsToPoll` also uses each job's `nextPollAt` as a lease: a worker
 *   that crashes mid-poll just leaves the job to be picked up again once that
 *   lease elapses, so a deploy mid-run doesn't lose paid provider compute.
 * - Clean shutdown (SIGINT/SIGTERM) aborts in-flight submit/poll calls and lets
 *   `failJob` requeue them.
 */
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { presignDownload } from "@/lib/storage";
import { getGenerator, type GeneratorInput } from "@/lib/generator";
import { sendSceneReady, sendSceneFailed } from "@/lib/email";
import {
  claimJobsToPoll,
  claimNextJobs,
  completeJob,
  countInFlightJobs,
  failJob,
  markSceneProcessing,
  recordSubmission,
  updateJobProgress,
  type ClaimedJob,
  type PollableJob,
} from "@/lib/jobs";

const generator = getGenerator();

function log(msg: string, extra?: Record<string, unknown>) {
  const tail = extra ? ` ${JSON.stringify(extra)}` : "";
  console.log(`${new Date().toISOString()} [worker] ${msg}${tail}`);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** Fail the job, emailing the owner on a scene that still exists if it's terminal. */
async function handleFailure(
  jobId: string,
  sceneId: string,
  attempts: number,
  err: unknown,
  signal: AbortSignal,
): Promise<void> {
  const message =
    signal.aborted && err instanceof Error && err.message === "aborted"
      ? "Worker shut down mid-run"
      : err instanceof Error
        ? err.message
        : String(err);
  const retried = await failJob(jobId, sceneId, attempts, message);
  log(retried ? "job failed, will retry" : "job failed permanently", {
    jobId,
    error: message,
  });

  if (!retried) {
    const scene = await db.scene.findUnique({
      where: { id: sceneId },
      select: { title: true, owner: { select: { email: true } } },
    });
    if (scene) {
      const sceneUrl = new URL(`/dashboard/scenes/${sceneId}`, env.APP_URL).toString();
      await sendSceneFailed(scene.owner.email, scene.title, sceneUrl).catch((err) => {
        log("scene-failed email failed", { jobId, error: (err as Error).message });
      });
    }
  }
}

/** Hand a freshly claimed job to the generator and record the handle it returns. */
async function submitJob(job: ClaimedJob, signal: AbortSignal): Promise<void> {
  log("claimed job", { jobId: job.id, sceneId: job.sceneId, attempt: job.attempts });

  const scene = await db.scene.findUnique({
    where: { id: job.sceneId },
    include: { assets: { orderBy: { position: "asc" } } },
  });

  if (!scene) {
    await failJob(job.id, job.sceneId, env.WORKER_MAX_ATTEMPTS, "Scene no longer exists");
    log("scene gone, job failed", { jobId: job.id });
    return;
  }

  await markSceneProcessing(scene.id);

  try {
    const input: GeneratorInput = {
      sceneId: scene.id,
      kind: scene.kind,
      assets: await Promise.all(
        scene.assets.map(async (a) => ({
          type: a.type,
          mimeType: a.mimeType,
          storageKey: a.storageKey,
          url: await presignDownload(a.storageKey),
        })),
      ),
    };

    const ref = await generator.submit(input, {
      signal,
      log: (m) => log(m, { jobId: job.id }),
    });
    await recordSubmission(job.id, ref);
    log("job submitted", { jobId: job.id, sceneId: scene.id });
  } catch (err) {
    await handleFailure(job.id, scene.id, job.attempts, err, signal);
  }
}

/** Check on one in-flight job and act on the generator's reported status. */
async function pollJob(job: PollableJob, signal: AbortSignal): Promise<void> {
  try {
    const result = await generator.poll(job.providerRef, {
      signal,
      log: (m) => log(m, { jobId: job.id }),
    });

    if (result.status === "running") {
      if (result.progress !== undefined) await updateJobProgress(job.id, result.progress);
      return;
    }

    if (result.status === "failed") {
      await handleFailure(job.id, job.sceneId, job.attempts, new Error(result.error), signal);
      return;
    }

    if (result.outputs.length === 0) throw new Error("Generator produced no outputs");
    await completeJob(job.id, job.sceneId, result.outputs);
    log("job succeeded", {
      jobId: job.id,
      sceneId: job.sceneId,
      outputs: result.outputs.length,
    });

    const scene = await db.scene.findUnique({
      where: { id: job.sceneId },
      select: { title: true, owner: { select: { email: true } } },
    });
    if (scene) {
      const sceneUrl = new URL(`/dashboard/scenes/${job.sceneId}`, env.APP_URL).toString();
      await sendSceneReady(scene.owner.email, scene.title, sceneUrl).catch((err) => {
        log("scene-ready email failed", { jobId: job.id, error: (err as Error).message });
      });
    }
  } catch (err) {
    await handleFailure(job.id, job.sceneId, job.attempts, err, signal);
  }
}

async function main() {
  const controller = new AbortController();
  let running = true;

  const stop = (sig: string) => {
    if (!running) return;
    running = false;
    log(`received ${sig}, shutting down`);
    controller.abort();
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));

  log("started", {
    generator: generator.name,
    pollMs: env.WORKER_POLL_INTERVAL_MS,
    maxAttempts: env.WORKER_MAX_ATTEMPTS,
    concurrency: env.WORKER_CONCURRENCY,
  });

  while (running) {
    let toPoll: PollableJob[] = [];
    let toSubmit: ClaimedJob[] = [];
    try {
      toPoll = await claimJobsToPoll(env.WORKER_CONCURRENCY);
      const inFlight = await countInFlightJobs();
      const submitBudget = Math.max(0, env.WORKER_CONCURRENCY - inFlight);
      toSubmit = submitBudget > 0 ? await claimNextJobs(submitBudget) : [];
    } catch (err) {
      log("claim failed", { error: err instanceof Error ? err.message : String(err) });
      await sleep(env.WORKER_POLL_INTERVAL_MS, controller.signal);
      continue;
    }

    if (toPoll.length === 0 && toSubmit.length === 0) {
      await sleep(env.WORKER_POLL_INTERVAL_MS, controller.signal);
      continue;
    }

    await Promise.allSettled([
      ...toPoll.map((j) => pollJob(j, controller.signal)),
      ...toSubmit.map((j) => submitJob(j, controller.signal)),
    ]);
  }

  await db.$disconnect();
  log("stopped");
  process.exit(0);
}

main().catch((err) => {
  log("fatal", { error: err instanceof Error ? err.stack ?? err.message : String(err) });
  process.exit(1);
});
