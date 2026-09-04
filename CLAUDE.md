# Working in this repo

Read `README.md` first — it covers the product, the milestones, local setup,
sharing, deployment and the known gaps. This file only holds things that aren't
obvious from the code.

## Conventions

**Keep route handlers thin.** Domain rules live in `src/lib/*` as plain
functions returning `{ ok, code, error }`; the route translates that to HTTP and
nothing else. `src/lib/jobs.ts` and `src/lib/share.ts` are the model —
`src/app/api/scenes/[id]/generate/route.ts` is ten lines because of it. The
asset routes still predate this and carry their domain logic inline; if you
touch them, pull it into a `src/lib/assets.ts`.

This matters beyond tidiness: the worker is a separate process that imports
`src/lib/*` directly with no HTTP hop. Anything trapped in a route handler is
unreachable from it, and untestable without booting Next.

**`server-only` is deliberate, and deliberately absent.** `src/lib/auth.ts` and
`src/lib/scenes.ts` carry it. `src/lib/storage.ts`, `src/lib/jobs.ts` and
`src/lib/env.ts` must not — the standalone worker imports them and it isn't a
React build. `src/lib/upload.ts` and `src/lib/outputs.ts` are shared with client
components, so keep server imports out of them entirely.

**Check licences before adding any 3D dependency.** The original Inria 3DGS code
is non-commercial and many impressive-looking derivatives inherit it silently —
FastGS, for instance, has no licence of its own and defers to 3DGS,
Taming-3DGS and Speedy-Splat. Confirmed safe here: three.js (MIT), Spark (MIT),
gsplat (Apache-2.0), AnySplat (MIT). Seed models are CC0 except the sofa
(CC BY 4.0); attribution is recorded in `SceneOutput.meta`.

## Traps that have already bitten

**Object-storage CORS.** The single most likely cause of "it works locally but
production is broken". MinIO allows cross-origin by default; R2 does not. See
the README's deployment section — `npm run cors` inspects and applies it.

**WebGL contexts and React StrictMode.** `createStage()` creates and owns its
own `<canvas>` rather than taking one from JSX. Disposal calls
`forceContextLoss()`, and a force-lost context cannot be re-acquired from the
same canvas element — which StrictMode's mount/unmount/mount does on every dev
render. Don't "simplify" this by passing a canvas ref in.

**Splats need sustained frames.** Spark sorts asynchronously across several
frames, so a splat that renders fine locally will appear blank anywhere
`requestAnimationFrame` is throttled — a hidden or non-compositing browser pane,
for instance. Meshes hide this because one frame paints a persistent image.
Before concluding the splat path is broken, check `rAF` is actually ticking.

**Verifying presigned URLs.** Two easy false alarms: R2 rejects `HEAD` against a
GET-signed URL (use the SDK's `headObject`, or a ranged `GET`), and extracting a
presigned URL from HTML with a naive regex truncates it at the first `&`,
dropping the signature. Both look exactly like a CORS failure.

**Prisma's engine DLL locks on Windows.** `npm run build` fails with `EPERM ...
query_engine-windows.dll.node` while the dev server is running. Stop it first.

**`railway.web.json`/`railway.worker.json` are dead.** Railway dropped
config-as-code (`railway.json`/`.toml`) for `.railway/railway.ts` and ignores
the old files with no warning. A service's build/start command has to be set
directly on the service instead (dashboard, or `serviceInstanceUpdate` over the
GraphQL API) — see the README's deployment section for the exact commands and
the failure symptom. Also: `railway redeploy` restarts the previous build's
snapshot as-is, config included — it will not pick up a command change you just
made. Use `railway up` for that.

**A shared sending domain poisons transactional email.** If the root domain
also does bulk/marketing sends, Gmail's domain-level reputation scoring can
land magic-link and scene-ready emails in spam even with SPF/DKIM verified.
Fix is a dedicated subdomain used for nothing but this app's mail — see the
README's "Email deliverability" section.

## Deploys

Deploys go through `railway up --service <web|worker>` (there is a GitHub
remote, but nothing auto-deploys from it yet). The web service runs `prisma
migrate deploy` on boot, so migrations ship with it. Railway's Postgres is
private; `railway run` executes locally with production variables, so scripts
needing the database also need the Postgres TCP proxy enabled and the host
swapped in `DATABASE_URL`.

Don't run bare `railway domain` to inspect domains — with no subcommand it
*creates* one. Use `railway domain list`.
