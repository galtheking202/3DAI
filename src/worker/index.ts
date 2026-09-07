/**
 * Generation worker. Runs as its own process (`npm run worker`, or the Railway
 * `worker` service). Polls the Job queue, hands each run to the configured
 * Generator3D, and writes the outputs back.
 *
 * Design notes:
 * - `claimNextJob()` uses FOR UPDATE SKIP LOCKED, so running several workers is
 *   safe and just increases throughput.
 * - A crash mid-run leaves the job RUNNING; it is not auto-reaped yet (a stale-
 *   job sweep is a later milestone). Clean shutdown (SIGINT/SIGTERM) aborts the
 *   in-flight generator and lets `failJob` requeue it.
 */
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { presignDownload } from "@/lib/storage";
import { getGenerator, type GeneratorInput } from "@/lib/generator";
import { sendSceneReady, sendSceneFailed } from "@/lib/email";
import {
  claimNextJob,
  completeJob,
  failJob,
  markSceneProcessing,
  type ClaimedJob,
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

async function runJob(job: ClaimedJob, signal: AbortSignal): Promise<void> {
  log("claimed job", { jobId: job.id, sceneId: job.sceneId, attempt: job.attempts });

  const scene = await db.scene.findUnique({
    where: { id: job.sceneId },
    include: {
      assets: { orderBy: { position: "asc" } },
      owner: { select: { email: true } },
    },
  });

  if (!scene) {
    await failJob(job.id, job.sceneId, env.WORKER_MAX_ATTEMPTS, "Scene no longer exists");
    log("scene gone, job failed", { jobId: job.id });
    return;
  }

  const sceneUrl = new URL(`/dashboard/scenes/${scene.id}`, env.APP_URL).toString();

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
          sizeBytes: Number(a.sizeBytes),
          url: await presignDownload(a.storageKey),
        })),
      ),
    };

    const outputs = await generator.generate(input, {
      signal,
      log: (m) => log(m, { jobId: job.id }),
    });

    if (outputs.length === 0) throw new Error("Generator produced no outputs");

    await completeJob(job.id, scene.id, outputs);
    log("job succeeded", { jobId: job.id, sceneId: scene.id, outputs: outputs.length });

    await sendSceneReady(scene.owner.email, scene.title, sceneUrl).catch((err) => {
      log("scene-ready email failed", { jobId: job.id, error: (err as Error).message });
    });
  } catch (err) {
    const message =
      signal.aborted && (err as Error).message === "aborted"
        ? "Worker shut down mid-run"
        : err instanceof Error
          ? err.message
          : String(err);
    const retried = await failJob(job.id, scene.id, job.attempts, message);
    log(retried ? "job failed, will retry" : "job failed permanently", {
      jobId: job.id,
      error: message,
    });

    if (!retried) {
      await sendSceneFailed(scene.owner.email, scene.title, sceneUrl).catch((err) => {
        log("scene-failed email failed", { jobId: job.id, error: (err as Error).message });
      });
    }
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
  });

  while (running) {
    let job: ClaimedJob | null = null;
    try {
      job = await claimNextJob();
    } catch (err) {
      log("claim failed", { error: err instanceof Error ? err.message : String(err) });
      await sleep(env.WORKER_POLL_INTERVAL_MS, controller.signal);
      continue;
    }

    if (!job) {
      await sleep(env.WORKER_POLL_INTERVAL_MS, controller.signal);
      continue;
    }

    await runJob(job, controller.signal);
  }

  await db.$disconnect();
  log("stopped");
  process.exit(0);
}

main().catch((err) => {
  log("fatal", { error: err instanceof Error ? err.stack ?? err.message : String(err) });
  process.exit(1);
});
