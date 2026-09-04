"use client";

import { useCallback, useState } from "react";
import type { ShareState } from "@/lib/share";

const EXPIRY_CHOICES: { label: string; days: number | null }[] = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "Never", days: null },
];

function formatExpiry(iso: string | null): string {
  if (!iso) return "never expires";
  const when = new Date(iso);
  const days = Math.ceil((when.getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "expired";
  return `expires in ${days} day${days === 1 ? "" : "s"}`;
}

export default function SharePanel({
  sceneId,
  initialShare,
  ready,
}: {
  sceneId: string;
  initialShare: ShareState | null;
  /** Sharing is only offered once there is something to look at. */
  ready: boolean;
}) {
  const [share, setShare] = useState<ShareState | null>(initialShare);
  const [expiryDays, setExpiryDays] = useState<number | null>(30);
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const save = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/scenes/${sceneId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expiresInDays: expiryDays,
          password: usePassword && password ? password : null,
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | { share?: ShareState; error?: string }
        | null;
      if (!res.ok || !body?.share) {
        setError(body?.error ?? "Could not create the link");
        return;
      }
      setShare(body.share);
      setPassword("");
    } finally {
      setBusy(false);
    }
  }, [sceneId, expiryDays, usePassword, password]);

  const revoke = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/scenes/${sceneId}/share`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        setError("Could not revoke the link");
        return;
      }
      setShare(null);
      setUsePassword(false);
    } finally {
      setBusy(false);
    }
  }, [sceneId]);

  const copy = useCallback(async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy — select the link and copy it manually.");
    }
  }, [share]);

  if (!ready) return null;

  const btn =
    "rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200";
  const field =
    "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-300";

  return (
    <section className="mt-10 border-t border-neutral-200 pt-6 dark:border-neutral-800">
      <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-500">
        Share
      </h2>

      {share ? (
        <>
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
            Anyone with this link can look at the 3D capture. They can&apos;t
            download it, and don&apos;t need an account.
          </p>

          <div className="mt-3 flex gap-2">
            <input
              readOnly
              value={share.url}
              onFocus={(e) => e.currentTarget.select()}
              className={`${field} font-mono text-xs`}
            />
            <button type="button" onClick={copy} className={btn}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <p className="mt-2 text-xs text-neutral-500">
            {share.hasPassword ? "Password protected · " : ""}
            {formatExpiry(share.expiresAt)}
          </p>

          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200">
              Change password or expiry
            </summary>
            <div className="mt-3 space-y-3">
              <Controls
                expiryDays={expiryDays}
                setExpiryDays={setExpiryDays}
                usePassword={usePassword}
                setUsePassword={setUsePassword}
                password={password}
                setPassword={setPassword}
                field={field}
                hasExistingPassword={share.hasPassword}
              />
              <button
                type="button"
                onClick={save}
                disabled={busy || (usePassword && password.length < 4)}
                className={btn}
              >
                {busy ? "Saving…" : "Update link"}
              </button>
              <p className="text-xs text-neutral-400">
                The link itself stays the same, so anyone you already sent it to
                keeps working.
              </p>
            </div>
          </details>

          <button
            type="button"
            onClick={revoke}
            disabled={busy}
            className="mt-4 text-xs text-neutral-500 underline underline-offset-2 hover:text-red-600 disabled:opacity-40"
          >
            Revoke this link
          </button>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
            Create a link you can send to a buyer. They see the item in 3D
            without signing up.
          </p>
          <div className="mt-4 max-w-sm space-y-3">
            <Controls
              expiryDays={expiryDays}
              setExpiryDays={setExpiryDays}
              usePassword={usePassword}
              setUsePassword={setUsePassword}
              password={password}
              setPassword={setPassword}
              field={field}
              hasExistingPassword={false}
            />
            <button
              type="button"
              onClick={save}
              disabled={busy || (usePassword && password.length < 4)}
              className={btn}
            >
              {busy ? "Creating…" : "Create share link"}
            </button>
          </div>
        </>
      )}

      {error ? (
        <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </section>
  );
}

function Controls({
  expiryDays,
  setExpiryDays,
  usePassword,
  setUsePassword,
  password,
  setPassword,
  field,
  hasExistingPassword,
}: {
  expiryDays: number | null;
  setExpiryDays: (d: number | null) => void;
  usePassword: boolean;
  setUsePassword: (v: boolean) => void;
  password: string;
  setPassword: (v: string) => void;
  field: string;
  hasExistingPassword: boolean;
}) {
  return (
    <>
      <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
        Expires
        <select
          value={expiryDays === null ? "never" : String(expiryDays)}
          onChange={(e) =>
            setExpiryDays(e.target.value === "never" ? null : Number(e.target.value))
          }
          className={`${field} mt-1`}
        >
          {EXPIRY_CHOICES.map((c) => (
            <option key={c.label} value={c.days === null ? "never" : c.days}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
        <input
          type="checkbox"
          checked={usePassword}
          onChange={(e) => setUsePassword(e.target.checked)}
        />
        Require a password
        {hasExistingPassword && !usePassword ? (
          <span className="text-neutral-400">(unchecking removes it)</span>
        ) : null}
      </label>

      {usePassword ? (
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 4 characters"
          className={field}
        />
      ) : null}
    </>
  );
}
