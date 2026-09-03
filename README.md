# 3DAI

Upload video + photos of an object, apartment, or vehicle → get a shareable,
access-controlled 3D space. 3D generation runs on a **mock engine** until World
Labs **Atlas** is available; the rest of the app is built against a single
`Generator3D` interface so Atlas drops in with no other changes.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS 4
- PostgreSQL via Prisma
- Object storage: MinIO locally, Cloudflare R2 in production (S3-compatible; one
  `S3Client` behind `src/lib/storage.ts`)
- Auth: passwordless email magic-link, DB-backed sessions
- Deploy target: Railway (`web` + `worker` services + managed Postgres)

## Milestones

1. ~~Scaffold — accounts & schema~~ ✓
2. **Upload (presigned direct-to-storage) + scene creation** ← current
3. Processing pipeline (queue + worker + `MockGenerator`)
4. Format-aware 3D viewer
5. Share links, visibility, password, expiry, revoke, public viewer
6. Buyer-inspection links, polish, tests

## Local development

Prerequisites: Node 20+, Docker.

```bash
cp .env.example .env
docker compose up -d          # postgres + minio + mailhog
npm install
npm run db:migrate            # creates the schema (first run: prompts for a name, use "init")
npm run dev                   # http://localhost:3000
```

Sign in: go to `/login`, enter any email. With `EMAIL_TRANSPORT=console` the
sign-in link is printed to the `npm run dev` terminal — open it to land on
`/dashboard`. Set `EMAIL_TRANSPORT=smtp` to send through MailHog instead
(inbox at http://localhost:8025).

Create a scene: **New scene** on the dashboard → title + type → on the scene
page, drag in a walkthrough video and photos. Each file is uploaded straight to
storage with a presigned `PUT` (MP4/MOV/WebM video up to 750 MB, JPEG/PNG/WebP/
HEIC images up to 30 MB, 60 files per scene); the server then HEADs the object
and records an `Asset` row. Generation is wired up in milestone 3.

### Handy URLs

| Service        | URL                     |
| -------------- | ----------------------- |
| App            | http://localhost:3000   |
| MinIO console  | http://localhost:9001   |
| MailHog inbox  | http://localhost:8025   |
| Prisma Studio  | `npm run db:studio`     |

## Environment

See `.env.example` for the full list: `DATABASE_URL`, `APP_URL`, the `EMAIL_*`
group, and the `S3_*` group. The `S3_*` defaults target the local MinIO in
`docker compose`, so no changes are needed for local dev; set the R2 values in
production.
