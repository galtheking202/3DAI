import { z } from "zod";

/**
 * Server-only environment. Do NOT import this from middleware or client code.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_COOKIE: z.string().default("sid"),

  EMAIL_TRANSPORT: z.enum(["console", "smtp", "resend"]).default("console"),
  EMAIL_FROM: z.string().default("3DAI <no-reply@localhost>"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),

  // Object storage. Defaults target the local MinIO in docker-compose; set the
  // R2 equivalents in production. Required from milestone 2 onward.
  S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  S3_REGION: z.string().default("auto"),
  S3_ACCESS_KEY_ID: z.string().min(1).default("minio"),
  S3_SECRET_ACCESS_KEY: z.string().min(1).default("minio12345"),
  S3_BUCKET: z.string().min(1).default("3dai-media"),
  S3_FORCE_PATH_STYLE: z.stringbool().default(true),

  GENERATOR: z.enum(["mock", "atlas"]).default("mock"),

  // Generation pipeline / worker.
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  WORKER_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  // Max jobs submitted to the hosted engine and not yet finished, across all
  // worker replicas at once (a soft cap: concurrent replicas can briefly
  // overshoot it). Size it to the engine's own concurrency/rate limits, not
  // this app's capacity.
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  // How often an in-flight job is polled. Also doubles as that job's lease:
  // another worker replica won't pick it up again until this elapses, so a
  // crash mid-poll just means the next poll happens late, not that the job
  // (and its paid compute) is lost.
  GENERATION_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  MOCK_GENERATOR_MIN_MS: z.coerce.number().int().nonnegative().default(2500),
  MOCK_GENERATOR_MAX_MS: z.coerce.number().int().nonnegative().default(6000),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", z.treeifyError(parsed.error));
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
