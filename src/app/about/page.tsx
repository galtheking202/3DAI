import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "About — 3DAI",
  description: "What 3DAI is and who runs it.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href="/"
        className="text-sm font-medium uppercase tracking-widest text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
      >
        3DAI
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">About 3DAI</h1>

      <div className="mt-8 space-y-4 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
        <p>
          3DAI turns a short walkthrough — a video and a few photos — into a 3D
          space you can open in a browser and share as a link. It is meant for
          the moment before someone decides: a buyer looking at furniture or a
          car, a renter looking at a flat, anyone who would otherwise ask for
          “more photos”.
        </p>
        <p>
          You keep control of who sees a capture. Every share link is unlisted,
          can carry a password or an expiry, and can be revoked at any time.
          Viewers can look around a model but cannot download it, and sign-in is
          a one-time email link — there is no password to steal, and 3DAI never
          asks for payment details or anything to install.
        </p>
        <p>
          3DAI is an independent project, currently in early preview. Capture,
          the 3D viewer, and share links work today; the 3D reconstruction
          pipeline is still in development and runs on a placeholder engine for
          now.
        </p>
        <p>
          Questions, problems, or feedback:{" "}
          <a
            className="underline underline-offset-2"
            href="mailto:galshaulker@gmail.com"
          >
            galshaulker@gmail.com
          </a>
          .
        </p>
      </div>

      <SiteFooter />
    </main>
  );
}
