"use client";

import { useEffect } from "react";

/**
 * One Google AdSense banner unit. The `adsbygoogle.js` loader is added once in
 * the root layout `<head>` (see `src/lib/ads.ts`); this only places the slot
 * and asks for a fill. Rendered only when ads are enabled AND an ad unit is
 * configured (`ADS_SLOT`).
 *
 * The parent gives it a fixed, bounded height so the share page still fits one
 * screen with nothing to scroll. If the loader never runs — an ad blocker, an
 * offline viewer, a region where ads are not served — the slot just stays
 * empty; nothing else on the page depends on it.
 */
export default function AdBanner({
  client,
  slot,
}: {
  client: string;
  slot: string;
}) {
  useEffect(() => {
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle || [];
      // adsbygoogle.js swaps this queue for its real implementation once loaded;
      // pushing before then is the documented way to request a fill.
      w.adsbygoogle.push({});
    } catch {
      // Loader blocked or not ready — leave the slot empty.
    }
  }, []);

  return (
    <ins
      className="adsbygoogle block h-full w-full"
      style={{ display: "block" }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="horizontal"
      data-full-width-responsive="false"
    />
  );
}
