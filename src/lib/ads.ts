import "server-only";

import { env } from "@/lib/env";

export type BannerAd = { client: string; slot: string };

/**
 * The AdSense publisher ID (`ca-pub-…`) to load `adsbygoogle.js` for, or `null`
 * when ads are off or no client is set. The root layout uses this to put the
 * loader in `<head>` on every page — which is where Google's site review looks
 * for it — so a site can be verified with just `ADS_ENABLED` + `ADS_CLIENT`,
 * before any ad unit exists.
 */
export function adsenseClient(): string | null {
  if (!env.ADS_ENABLED || !env.ADS_CLIENT) return null;
  return env.ADS_CLIENT;
}

/**
 * The AdSense banner shown under the model on public share pages, or `null`
 * when ads are off or not fully configured.
 *
 * Toggle with `ADS_ENABLED` in Railway; `ADS_CLIENT` (the `ca-pub-…` publisher
 * ID) and `ADS_SLOT` (the ad unit ID) come from the AdSense dashboard. All
 * three must be present for a banner to render — with the toggle and client
 * set but no slot, the loader still ships (so the site can be reviewed) and
 * this just returns `null`, so nothing renders a broken slot.
 */
export function bannerAd(): BannerAd | null {
  if (!env.ADS_ENABLED) return null;
  if (!env.ADS_CLIENT || !env.ADS_SLOT) return null;
  return { client: env.ADS_CLIENT, slot: env.ADS_SLOT };
}
