/**
 * The 3DAI mark (the same cube as `src/app/icon.svg`) plus the wordmark, as a
 * lockup for page headers and the footer. Theme-aware: dark chip in light mode,
 * light chip in dark mode. Presentational only — wrap it in a <Link> where a
 * click-home affordance is wanted.
 */
export default function Logo({
  className = "",
  withWordmark = true,
}: {
  className?: string;
  withWordmark?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        aria-hidden="true"
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-neutral-900 dark:bg-white"
      >
        <svg viewBox="0 0 32 32" className="h-4 w-4">
          <g
            fill="none"
            className="stroke-white dark:stroke-neutral-900"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 5.5 L25.5 11 L25.5 21 L16 26.5 L6.5 21 L6.5 11 Z" />
            <path d="M16 5.5 L16 16 M16 16 L25.5 11 M16 16 L6.5 11" />
          </g>
        </svg>
      </span>
      {withWordmark ? (
        <span className="text-sm font-medium uppercase tracking-widest text-neutral-500">
          3DAI
        </span>
      ) : null}
    </span>
  );
}
