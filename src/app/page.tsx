import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-widest text-neutral-500">
        3DAI
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
        Spatial captures you own.
      </h1>
      <p className="mt-5 max-w-xl text-lg text-neutral-600 dark:text-neutral-400">
        Upload a walkthrough video and photos of an object, apartment, or
        vehicle. 3DAI turns them into a live 3D space you can share as a link —
        and you decide who gets in.
      </p>

      <div className="mt-8 flex gap-3">
        {user ? (
          <Link
            href="/dashboard"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Go to dashboard
          </Link>
        ) : (
          <Link
            href="/login"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Sign in
          </Link>
        )}
      </div>

      <p className="mt-10 text-xs text-neutral-400">
        Early preview — capture, viewer and share links are working. 3D
        generation still runs on a mock engine.
      </p>

      <p className="mt-4 text-xs text-neutral-400">
        <Link href="/privacy" className="underline underline-offset-2">
          Privacy
        </Link>
      </p>
    </main>
  );
}
