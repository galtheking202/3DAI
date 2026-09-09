import { adsTxt } from "@/lib/ads";

export const runtime = "nodejs";
// Read the publisher ID from the running process, not the build: Railway injects
// env at runtime, and ADS_CLIENT may not exist when `next build` runs.
export const dynamic = "force-dynamic";

/**
 * `/ads.txt` — AdSense fetches this from the domain root to verify that Google
 * may sell inventory here. Built from `ADS_CLIENT` (see `src/lib/ads.ts`);
 * responds 404 when no publisher ID is configured so unconfigured deploys don't
 * serve an empty authorisation file.
 */
export function GET() {
  const body = adsTxt();
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
