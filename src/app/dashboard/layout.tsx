import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { presignDownload } from "@/lib/storage";
import Logo from "@/components/Logo";
import UserMenu from "@/components/UserMenu";

/**
 * Top bar for every signed-in page — the dashboard, a scene, the new-scene
 * form. Puts the logo and the account menu in one place so each page under
 * /dashboard doesn't re-declare them.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const avatarUrl = user?.image ? await presignDownload(user.image) : null;

  return (
    <>
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <Link href="/dashboard" aria-label="3DAI dashboard" className="inline-block">
            <Logo />
          </Link>
          {user ? <UserMenu email={user.email} imageUrl={avatarUrl} /> : null}
        </div>
      </header>
      {children}
    </>
  );
}
