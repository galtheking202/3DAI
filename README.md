# 3DAI

Upload video + photos of an object, apartment, or vehicle → get a shareable,
access-controlled 3D space.

**The idea:** when you're selling something — a piece of furniture, a car, an
apartment, a one-off collectible — flat photos never quite convey the real thing.
3DAI turns a short walkthrough into a 3D environment the other person can move
around in, so a buyer can actually grasp the item's size, condition, and shape
before they commit. You capture once, then hand out links: unlisted, password-
protected, time-limited, or revocable, so the right people get in and no one else
does.

3D generation runs on a **mock engine** today. The real engine is still to be
chosen and built (milestone 6); everything else in the app sits behind a single
`Generator3D` interface so the pipeline doesn't care which one wins.

The original plan was World Labs **Atlas**, but as of September 2026 it is
early-access only with no public API, pricing or GA date, so it can't be
committed to. The current recommendation is to self-host **gsplat**
(Apache-2.0) for quality with **AnySplat** (MIT) as a seconds-fast preview —
see [Known gaps](#known-gaps). Note also that Atlas is a *world model*, tuned to
generate plausible spaces, which is not the same goal as faithfully capturing a
specific second-hand item.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS 4
- PostgreSQL via Prisma
- Object storage: MinIO locally, Cloudflare R2 in production (S3-compatible; one
  `S3Client` behind `src/lib/storage.ts`)
- Auth: passwordless email magic-link, DB-backed sessions
- Viewer: three.js for glTF meshes, [Spark](https://sparkjs.dev) for Gaussian
  splats (both MIT, both WebGL2 — no WebGPU gate, so iOS/Android work)
- Deploy target: Railway (`web` + `worker` services + managed Postgres)

## Milestones

1. ~~Scaffold — accounts & schema~~ ✓
2. ~~Upload (presigned direct-to-storage) + scene creation~~ ✓
3. ~~Processing pipeline (queue + worker + `MockGenerator`)~~ ✓
4. ~~Format-aware 3D viewer~~ ✓
5. ~~Share links: password, expiry, revoke, public viewer~~ ✓
6. **Real 3D generation, polish, tests** ← current

See [Known gaps](#known-gaps) for what milestone 6 still has to cover.

## Local development

Prerequisites: Node 20+, Docker.

```bash
cp .env.example .env
docker compose up -d          # postgres + minio + mailhog
npm install
npm run db:migrate            # creates the schema (first run: prompts for a name, use "init")
npm run dev                   # http://localhost:3000
npm run worker                # generation worker — separate terminal
```

Sign in: go to `/login`, enter any email. With `EMAIL_TRANSPORT=console` the
sign-in link is printed to the `npm run dev` terminal — open it to land on
`/dashboard`. Set `EMAIL_TRANSPORT=smtp` to send through MailHog instead
(inbox at http://localhost:8025).

Create a scene: **New scene** on the dashboard → title + type → on the scene
page, drag in a walkthrough video and photos. Each file is uploaded straight to
storage with a presigned `PUT` (MP4/MOV/WebM video up to 750 MB, JPEG/PNG/WebP/
HEIC images up to 30 MB, 60 files per scene); the server then HEADs the object
and records an `Asset` row.

Generate: **Generate 3D** on the scene page enqueues a `Job` and flips the scene
to `QUEUED`. The worker (`npm run worker`) claims it (`FOR UPDATE SKIP LOCKED`,
so you can run several), runs the configured `Generator3D`, writes `SceneOutput`
rows and sets the scene `READY`. Failures retry up to `WORKER_MAX_ATTEMPTS`, then
land in `FAILED` with a "Try again" button. The scene page polls while a run is
live.

`GENERATOR` selects the engine:

- `mock` (default) — `MockGenerator` uploads a bundled sample GLB after a short
  delay. Ignores the input.
- `meshy` — `MeshyGenerator` sends up to 4 of the scene's JPEG/PNG photos to
  Meshy's [multi-image-to-3D API](https://docs.meshy.ai/en/api/multi-image-to-3d),
  polls the task, and stores the textured GLB. **Generative**, not
  photogrammetry: it invents plausible geometry, so proportions are not
  reliable and it suits `OBJECT` scenes, not whole `APARTMENT`/`VEHICLE`
  captures. Needs `MESHY_API_KEY`; `MESHY_AI_MODEL` and
  `MESHY_TEXTURE_RESOLUTION` tune quality vs. credit cost.
- `kiri` — `KiriGenerator` uploads the scene's walkthrough **video** (or, if
  there's no video, >=20 photos) to the
  [KIRI Engine API](https://docs.kiriengine.app/), polls `getStatus`, then
  downloads the result zip and stores the `.glb` from it. **Photogrammetry** —
  real reconstruction, so proportions are trustworthy and it handles spaces
  and vehicles too. Needs `KIRI_API_KEY`; `KIRI_MODEL_QUALITY`,
  `KIRI_TEXTURE_QUALITY` and `KIRI_MASK` (background removal) tune it. Video
  must be <=1080p / <=3 min; the generator caps the upload at 300 MB.
- `atlas` — World Labs Atlas placeholder, not implemented.

Both real engines run their upload + poll inside the single `generate()` call
and honour the shutdown signal, so they fit the existing worker with no
pipeline changes — but one worker is tied up for the whole (often long) run;
scale by running more workers. A retry after the external task was created
starts a fresh one and spends more credits.

Processing runs entirely on the `worker` process, independent of any browser
tab — closing the tab mid-run doesn't stop or lose the job. To let a user know
their model is ready without keeping the page open, the worker emails the scene
owner on terminal outcomes: `sendSceneReady` when a job succeeds, `sendSceneFailed`
when it exhausts `WORKER_MAX_ATTEMPTS` (see `src/worker/index.ts`). Both go
through the same `EMAIL_TRANSPORT` as the magic link.

View: once the scene is `READY` the page renders it inline. The viewer picks a
renderer from `SceneOutput.format` — `GLB` through three.js `GLTFLoader`,
`SPLAT`/`SPZ`/`SOG` through Spark. Both are loaded with `next/dynamic`, so the
~500 kB of 3D engine is fetched only when a viewer actually mounts and never
lands in the dashboard bundle.

Seed some realistic scenes instead of generating your own:

```bash
npm run seed                  # 5 scenes: 4 GLB models + 1 SPZ splat, with photos
```

It downloads small permissively licensed models (CC0, except the sofa which is
CC BY 4.0), uploads them to storage, and writes the `Scene` / `Asset` / `Job` /
`SceneOutput` rows a real generation run would have produced. It needs a user,
so sign in once first. Re-running replaces only the seeded scenes.

### Handy URLs

| Service        | URL                     |
| -------------- | ----------------------- |
| App            | http://localhost:3000   |
| MinIO console  | http://localhost:9001   |
| MailHog inbox  | http://localhost:8025   |
| Prisma Studio  | `npm run db:studio`     |

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next dev server |
| `npm run worker` | Generation worker (separate process) |
| `npm run seed` | Seed 5 finished scenes with real models |
| `npm run cors` | Show storage CORS policy (`-- --apply` to write it) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Create + apply a migration |

## Sharing

The core flow: a seller captures an item, then sends a link a buyer can open
without an account.

- **One link per scene.** Create/copy it from the dashboard list or the 🔗
  button next to the 3D viewer's download button on the scene page. The first
  click on an unshared scene mints a link (30 days, no password) and copies it.
- **`/s/<slug>`** is public — no auth, no account. It re-resolves the link on
  every load, so revoke and expiry take effect immediately.
- **Optional password** (`scrypt` from `node:crypto`). The unlock cookie is an
  HMAC keyed on the stored hash, so changing the password invalidates existing
  unlocks and there is no separate app secret to configure.
- **Optional expiry** — 7/30/90 days or never.
- **Revoke** kills the link; the slug is never reused. Changing password or
  expiry keeps the same slug, so people you already sent it to aren't cut off.
  Password, expiry and revoke are `POST`/`DELETE /api/scenes/[id]/share`
  operations only for now — there's no dashboard UI for them since the share
  panel was replaced by the one-click button above.
- **Viewers get no download button.** The model still reaches their browser in
  order to render at all, so this removes the affordance rather than protecting
  the bytes.
- **Link previews**: OG/Twitter tags from the scene, plus `noindex` so unlisted
  links stay out of search. A revoked or expired link unfurls as "Link
  unavailable" rather than leaking what was being sold.

### Why share views presign for 15 minutes

Two different clocks, easily confused:

| | Lifetime | Set by |
| --- | --- | --- |
| The share link (`/s/<slug>`) | weeks, or never expires | `ShareLink.expiresAt` |
| The storage URL behind it | 15 minutes | `SHARE_URL_TTL_SECONDS` |

A presigned URL is a bearer token — it keeps working for its full lifetime no
matter what happens to the `ShareLink`. Minting a fresh short-lived one on every
page load bounds how long a revoked link can still pull bytes, without the app
having to proxy the data. It deliberately isn't shorter: Spark streams splats
progressively, so the URL has to outlive a whole viewing session.

Note that revoke only controls *future* access. Anyone who already viewed a
scene necessarily downloaded the model to render it, and no design can take that
back.

## Environment

See `.env.example` for the full list: `DATABASE_URL`, `APP_URL`, the `EMAIL_*`
group, and the `S3_*` group. The `S3_*` defaults target the local MinIO in
`docker compose`, so no changes are needed for local dev; set the R2 values in
production.

`APP_URL` matters more than it looks: share links are built server-side as
`${APP_URL}/s/<slug>`. If you put a custom domain on the app, update `APP_URL`
at the same time or newly created links will point at the old hostname. Existing
links keep working either way — only the slug is stored.

`MESHY_API_KEY` / `KIRI_API_KEY` are required only when the matching
`GENERATOR` is selected, and only on the `worker` service (the web service
never generates). Set the key and `GENERATOR` together, then redeploy:

```bash
railway variables set KIRI_API_KEY=<key> --service worker --skip-deploys
railway variables set GENERATOR=kiri --service worker --skip-deploys
railway up --service worker
```

`MESHY_AI_MODEL` (default `meshy-5`; `latest` for best quality at more credits)
and `MESHY_TEXTURE_RESOLUTION` (`2k`/`4k`/`8k`) trade Meshy quality against
cost. `KIRI_MODEL_QUALITY` / `KIRI_TEXTURE_QUALITY` (`0`–`3`) and `KIRI_MASK`
(`true` to isolate the object from its background) do the same for KIRI.

`ADS_ENABLED` is the master switch for Google AdSense. With `ADS_ENABLED` +
`ADS_CLIENT` (your `ca-pub-…` publisher ID) the `adsbygoogle.js` loader is
rendered in the root layout `<head>` on every page — that is what Google's
site review checks for, so the site can be verified before any ad unit
exists. Add `ADS_SLOT` (a display ad unit ID) and a single banner appears
under the model on public `/s/<slug>` pages — nowhere else, and never on an
owner's own dashboard (`src/lib/ads.ts`, `src/components/AdBanner.tsx`).
Setting the vars needs a `railway up` rebuild, not just `railway redeploy`.
There is no consent/CMP layer yet, so check your obligations before serving
EU traffic at scale.

## Deployment (Railway)

Two services plus managed Postgres. The repo has a GitHub remote
(`galtheking202/3DAI`), but nothing auto-deploys from it — deploys go through
the CLI:

```bash
railway up --service web        # runs `prisma migrate deploy` on boot
railway up --service worker
```

`railway run --service web -- <cmd>` runs a local command with production
variables — useful for one-off scripts.

### Service config lives in Railway, not in this repo

`railway.web.json` / `railway.worker.json` are **not read by Railway** — Railway
deprecated `railway.json`/`railway.toml` config-as-code in favor of
`.railway/railway.ts`, and silently ignores the old files rather than erroring.
Each service's build/start command is instead set directly on the service
(Settings → Deploy in the dashboard, or `serviceInstanceUpdate` over the GraphQL
API). If a service ever needs relinking or was created from a template, set these
by hand — copying them from the JSON files above, which are kept only as
human-readable reference:

| Service  | Build command         | Start command       | Restart policy |
| -------- | ---------------------- | -------------------- | --------------- |
| `web`    | `npm run build`         | `npm run start:web`  | on failure       |
| `worker` | `npm run db:generate`   | `npm run worker`     | always           |

Symptom if this is ever wrong: `web` runs plain `next start` instead of
`start:web`, which logs `"next start" does not work with "output: standalone"`
and skips `prisma migrate deploy` — the app then 500s on any query against a
table from an unapplied migration.

Likewise, `railway redeploy` restarts the **previous build's** snapshot,
config included — it will not pick up a build/start command change you just
made. Use `railway up --service <name>` for a fresh build when service config
or source has changed; `redeploy` is only for restarting the current one as-is.

### Object storage needs a CORS policy

**This is the one thing that will silently break production.** The browser talks
to storage directly — presigned `PUT`s when uploading, presigned `GET`s when the
viewer streams a model. MinIO allows cross-origin by default, so local dev works
unconfigured and the problem only appears in production, where R2 refuses and
the browser blocks the response before any JS sees it. The upload or viewer just
fails with no useful error.

```bash
railway run --service web -- npm run cors            # show current policy
railway run --service web -- npm run cors -- --apply # write it (needs an admin token)
```

The app's own R2 token usually has object read/write but not bucket admin, in
which case `--apply` returns `Access Denied` and you set the policy in the
Cloudflare dashboard instead (R2 → bucket → Settings → CORS Policy):

```json
[
  {
    "AllowedOrigins": ["https://your-app-domain", "http://localhost:3000"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["Content-Length", "Content-Range", "Content-Type", "ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

`PUT` matters as much as `GET` — uploads break without it. `Content-Length`
drives the viewer's progress bar and `Content-Range` is needed for Spark's
ranged splat streaming. Add any custom domain here too.

### Email deliverability needs its own subdomain

`EMAIL_FROM` should not be an address on your bare root domain if that domain
(or any address on it) is also used for bulk/marketing/cold-outreach sending —
Gmail and friends score reputation at the domain level, so a poisoned root
domain drags transactional mail (magic links, scene-ready notices) into spam
right along with it, even though SPF/DKIM verify fine.

Fix: create a subdomain used for **nothing but this app's transactional mail**
(e.g. `mail.<yourdomain>`), verify it as its own domain in Resend, and point
`EMAIL_FROM` at an address on it. Its reputation stays isolated from whatever
else the root domain sends. Steps:

1. Resend → Domains → Add Domain → `mail.<yourdomain>`
2. Add the 3 DNS records Resend returns (one DKIM `TXT`, one SPF `TXT`, one SPF
   `MX`) at your DNS provider, all scoped under `mail.<yourdomain>`
3. Wait for Resend to flip the domain to `verified` — DNS itself resolves
   correctly within seconds, but Resend's own recheck can lag **up to ~30
   minutes** behind that; a `pending` status right after adding records is
   normal, not a misconfiguration
4. Set `EMAIL_FROM="3DAI <onboarding@mail.<yourdomain>>"` on the `web` service
   and redeploy

### Seeding a deployed environment

Railway's Postgres is only reachable from inside its private network, while R2
is reachable from anywhere, so the seed splits into two phases:

```bash
railway run --service web -- node --import tsx scripts/seed-showcase.ts --upload-only manifest.json
# then, from somewhere that can reach the database:
node --import tsx scripts/seed-showcase.ts --db-only manifest.json
```

Scene ids are minted up front so both phases agree on storage keys. For the
database half you need a route to Postgres — enable the TCP proxy on the
Postgres service in the Railway dashboard and swap the host/port of
`DATABASE_URL` for the proxy's.

## Known gaps

Carried into milestone 6:

- **Generation ignores the input.** `MockGenerator` uploads a fixed sample
  regardless of what was uploaded, so "take a video of your item" isn't real
  yet. Real reconstruction means Gaussian splatting — [gsplat](https://github.com/nerfstudio-project/gsplat)
  (Apache-2.0) for quality, [AnySplat](https://github.com/InternRobotics/AnySplat)
  (MIT) for a seconds-fast preview. **Check licences first**: the original Inria
  3DGS code is non-commercial, and many derivative repos inherit that.
- **`Generator3D` is a single blocking call.** Real engines are submit-then-poll
  over minutes. The interface needs `submit()` → handle and `poll(handle)`, plus
  `providerRef`/`progress` on `Job`, or a deploy mid-run loses paid compute.
- **No stale-job reaper.** A worker crash leaves a job `RUNNING` and the scene
  stuck `PROCESSING` forever.
- **No share preview image.** Links unfurl with title and description but no
  thumbnail, so they look plain in WhatsApp — the place these links get pasted.
- **Session ids are `cuid()`**, used directly as the cookie value. That's a
  collision-resistant id, not a secret; sessions want `randomBytes` like the
  magic-link tokens already use.
- **No rate limit on `/api/auth/request`.** With `EMAIL_TRANSPORT=resend` that
  endpoint is an open email-bomb amplifier pointed at your own sending domain.
- **A scene is a one-way door.** Once `READY` it can't be edited, regenerated or
  deleted, and orphaned storage objects are never collected.
- **No tests and no CI.** `npm run lint` isn't wired to an ESLint config either.
