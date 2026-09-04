/**
 * Password prompt for a protected share link. A plain form post so it works
 * without JS; the route sets the unlock cookie and redirects back here.
 */
export default function PasswordGate({
  slug,
  wrongPassword,
}: {
  slug: string;
  wrongPassword: boolean;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="text-sm font-medium uppercase tracking-widest text-neutral-500">
        3DAI
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        This link is password protected
      </h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Enter the password you were given to view the 3D capture.
      </p>

      <form
        method="post"
        action={`/api/share/${slug}/unlock`}
        className="mt-6 space-y-3"
      >
        <input
          name="password"
          type="password"
          required
          autoFocus
          autoComplete="off"
          placeholder="Password"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-300"
        />
        <button
          type="submit"
          className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          View
        </button>
      </form>

      {wrongPassword ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          That password isn&apos;t right. Try again.
        </p>
      ) : null}
    </main>
  );
}
