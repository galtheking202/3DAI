import Link from "next/link";
import Logo from "@/components/Logo";

/** Shared footer for the public pages — the "this is a real product" markers
 *  (owner, contact, policies) that a bare app is missing. */
export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-neutral-200 pt-6 text-xs text-neutral-500 dark:border-neutral-800">
      <Link href="/" aria-label="3DAI home" className="inline-block">
        <Logo />
      </Link>
      <p className="mt-3">
        3DAI is an independent early-preview project. Questions:{" "}
        <a
          className="underline underline-offset-2"
          href="mailto:galshaulker@gmail.com"
        >
          galshaulker@gmail.com
        </a>
      </p>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <span>© {new Date().getFullYear()} 3DAI</span>
        <Link className="underline underline-offset-2" href="/about">
          About
        </Link>
        <Link className="underline underline-offset-2" href="/privacy">
          Privacy
        </Link>
        <Link className="underline underline-offset-2" href="/terms">
          Terms
        </Link>
      </p>
    </footer>
  );
}
