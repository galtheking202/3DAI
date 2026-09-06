import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

const MESSAGES: Record<string, string> = {
  email: "That doesn't look like a valid email address.",
  invalid: "That sign-in link was malformed. Request a new one.",
  expired: "That sign-in link has expired. Request a new one.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const sp = await searchParams;
  const sent = sp.sent === "1";
  const errorKey = typeof sp.error === "string" ? sp.error : undefined;
  const next = typeof sp.next === "string" ? sp.next : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="text-sm font-medium uppercase tracking-widest text-neutral-500">
        3DAI
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Enter your email and we&apos;ll send you a one-time sign-in link.
      </p>

      {sent ? (
        <div className="mt-6 rounded-md border border-green-600/30 bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-300">
          Check your inbox for the sign-in link. In local dev it&apos;s printed
          to the server log.
        </div>
      ) : (
        <form method="post" action="/api/auth/request" className="mt-6 space-y-3">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-300"
          />
          <button
            type="submit"
            className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Send sign-in link
          </button>
        </form>
      )}

      {errorKey ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          {MESSAGES[errorKey] ?? "Something went wrong. Try again."}
        </p>
      ) : null}

      <p className="mt-10 text-xs text-neutral-400">
        <Link href="/privacy" className="underline underline-offset-2">
          Privacy
        </Link>
      </p>
    </main>
  );
}
