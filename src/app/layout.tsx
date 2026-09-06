import type { Metadata } from "next";
import { adsenseClient } from "@/lib/ads";
import "./globals.css";

export const metadata: Metadata = {
  title: "3DAI — spatial captures you own",
  description:
    "Upload video and photos of an object, apartment, or vehicle. Get a shareable 3D space whose access you control.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The AdSense loader goes in <head> on every page — that is where Google's
  // site review looks for it. Gated by ADS_ENABLED, so it is also the ad
  // kill switch; individual ad units are placed per page (see AdBanner).
  const adsClient = adsenseClient();

  return (
    <html lang="en">
      <head>
        {adsClient ? (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsClient}`}
            crossOrigin="anonymous"
          />
        ) : null}
      </head>
      <body className="min-h-screen bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        {children}
      </body>
    </html>
  );
}
