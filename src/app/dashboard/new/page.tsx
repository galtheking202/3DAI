import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

const KINDS: { value: string; label: string }[] = [
  { value: "OBJECT", label: "Object" },
  { value: "APARTMENT", label: "Apartment / space" },
  { value: "VEHICLE", label: "Vehicle" },
  { value: "OTHER", label: "Other" },
];

export default async function NewScenePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/new");

  const sp = await searchParams;
  const hasError = sp.error === "invalid";

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <Link
        href="/dashboard"
        className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
      >
        ← Your scenes
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">New scene</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Name it and pick what you&apos;re capturing. You&apos;ll add the video and
        photos on the next screen.
      </p>

      {hasError ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          Please give the scene a title (120 characters or fewer).
        </p>
      ) : null}

      <form method="post" action="/api/scenes" className="mt-6 space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            maxLength={120}
            autoFocus
            placeholder="Grandpa's armchair"
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-300"
          />
        </div>

        <div>
          <label htmlFor="kind" className="block text-sm font-medium">
            Type
          </label>
          <select
            id="kind"
            name="kind"
            defaultValue="OBJECT"
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-300"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium">
            Description <span className="text-neutral-400">(optional)</span>
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={2000}
            placeholder="Anything a viewer should know about this capture."
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-300"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Create scene
          </button>
          <Link
            href="/dashboard"
            className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
