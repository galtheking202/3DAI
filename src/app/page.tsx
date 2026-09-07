import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "3DAI — shareable 3D captures of your objects and spaces",
  description:
    "Upload a walkthrough video and photos of an object, apartment, or vehicle. 3DAI turns them into a 3D space you can share as a link, with access you control.",
};

const STEPS = [
  {
    n: "1",
    title: "Upload a walkthrough",
    body: "A short video and a few photos of the thing you want to capture. Files upload straight from your browser to storage.",
  },
  {
    n: "2",
    title: "We build the 3D space",
    body: "The capture is reconstructed into a model your viewers can orbit, zoom, and pan — in the browser, with no app to install.",
  },
  {
    n: "3",
    title: "Share a link you control",
    body: "Send it to anyone. Add a password or an expiry date, and revoke the link whenever you want. Viewers can look, not download.",
  },
];

const KINDS = [
  { title: "Objects", body: "Furniture, equipment, collectibles — anything you would photograph for a listing." },
  { title: "Apartments & spaces", body: "Walk a room or a whole flat before someone visits in person." },
  { title: "Vehicles", body: "Show a car, motorcycle, or boat from every angle before a sale." },
];

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <nav className="flex items-center justify-between">
        <span className="text-sm font-medium uppercase tracking-widest text-neutral-500">
          3DAI
        </span>
        <Link
          href={user ? "/dashboard" : "/login"}
          className="text-sm text-neutral-600 underline underline-offset-2 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          {user ? "Dashboard" : "Sign in"}
        </Link>
      </nav>

      <section className="mt-16">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Spatial captures you own.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-neutral-600 dark:text-neutral-400">
          Upload a walkthrough video and photos of an object, apartment, or
          vehicle. 3DAI turns them into a live 3D space you can share as a link —
          and you decide who gets in.
        </p>
        <div className="mt-8">
          <Link
            href={user ? "/dashboard" : "/login"}
            className="inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {user ? "Go to your dashboard" : "Sign in to get started"}
          </Link>
        </div>
      </section>

      <section className="mt-20">
        <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-500">
          How it works
        </h2>
        <ol className="mt-6 space-y-6">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-4">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-sm font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
                {s.n}
              </span>
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {s.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-20">
        <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-500">
          What you can capture
        </h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {KINDS.map((k) => (
            <div key={k.title}>
              <p className="font-medium">{k.title}</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {k.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-20">
        <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-500">
          You control access
        </h2>
        <p className="mt-6 max-w-xl text-sm text-neutral-600 dark:text-neutral-400">
          A share link is unlisted and re-checked on every visit, so revoking or
          expiring one takes effect immediately. Viewers get no download button.
          Sign-in is a one-time email link — 3DAI never asks you for a password,
          a payment, or anything to install.
        </p>
      </section>

      <section className="mt-20 rounded-lg border border-neutral-200 px-5 py-4 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
        <span className="font-medium text-neutral-900 dark:text-neutral-200">
          Early preview.
        </span>{" "}
        Capture, the 3D viewer, and share links work today. 3D generation
        currently runs on a placeholder engine while the reconstruction pipeline
        is in development.
      </section>

      <SiteFooter />
    </main>
  );
}
