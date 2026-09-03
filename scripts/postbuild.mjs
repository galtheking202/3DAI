// Next.js `output: "standalone"` emits `.next/standalone/` with a self-contained
// server.js but WITHOUT the static assets or `public/`. Copy them in so the
// standalone server can be run directly (`node .next/standalone/server.js`),
// which is how the Railway `web` service starts. No-op when there is no
// standalone build (e.g. `next dev`).
import { cpSync, existsSync } from "node:fs";

const standalone = ".next/standalone";

if (!existsSync(standalone)) {
  console.log("postbuild: no standalone output, nothing to copy");
  process.exit(0);
}

if (existsSync("public")) {
  cpSync("public", `${standalone}/public`, { recursive: true });
}
cpSync(".next/static", `${standalone}/.next/static`, { recursive: true });

console.log("postbuild: copied public/ and .next/static into .next/standalone");
