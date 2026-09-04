// No "server-only" marker so the public share route can import the pure
// helpers; every DB-touching function here is server-side only in practice.
import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { ShareLink } from "@prisma/client";
import { db } from "@/lib/db";

/** One share link per scene: the active one is the newest that isn't revoked. */
export type ShareState = {
  slug: string;
  url: string;
  hasPassword: boolean;
  expiresAt: string | null;
  createdAt: string;
};

export type ShareResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: number; error: string };

/* ---------------------------------------------------------------- passwords */

const SCRYPT_KEYLEN = 32;

/** `salt:derivedKey`, both hex. scrypt is in node:crypto — no dependency. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/* ------------------------------------------------------------ unlock cookie */

export function unlockCookieName(slug: string): string {
  return `share_${slug}`;
}

/**
 * Proof that this browser already entered the right password, keyed on the
 * stored hash so it invalidates automatically when the password changes and
 * needs no separate app secret. The hash never leaves the server.
 */
export function unlockToken(slug: string, passwordHash: string): string {
  return createHmac("sha256", passwordHash).update(slug).digest("hex");
}

export function checkUnlockToken(
  slug: string,
  passwordHash: string,
  presented: string | undefined,
): boolean {
  if (!presented) return false;
  const expected = Buffer.from(unlockToken(slug, passwordHash), "utf8");
  const actual = Buffer.from(presented, "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/* ------------------------------------------------------------------- queries */

function slugFor(): string {
  // 12 url-safe chars — unguessable, and short enough to paste in a message.
  return randomBytes(9).toString("base64url");
}

function isLive(link: ShareLink): boolean {
  if (link.revokedAt) return false;
  if (link.expiresAt && link.expiresAt < new Date()) return false;
  return true;
}

function toState(link: ShareLink, appUrl: string): ShareState {
  return {
    slug: link.slug,
    url: `${appUrl.replace(/\/$/, "")}/s/${link.slug}`,
    hasPassword: link.passwordHash !== null,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    createdAt: link.createdAt.toISOString(),
  };
}

/** The scene's active share link, or null when it isn't shared. */
export async function activeShare(
  sceneId: string,
  appUrl: string,
): Promise<ShareState | null> {
  const link = await db.shareLink.findFirst({
    where: { sceneId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!link || !isLive(link)) return null;
  return toState(link, appUrl);
}

export type ShareOptions = {
  /** Days until the link stops working; null means it never expires. */
  expiresInDays: number | null;
  /** Empty or null clears the password. */
  password: string | null;
};

/**
 * Create the scene's share link, or update the existing one in place. Keeping
 * the slug stable matters: the owner may already have sent it to someone, and
 * changing a password or expiry shouldn't silently break that. Use `revoke` to
 * deliberately kill a link.
 */
export async function upsertShare(
  sceneId: string,
  userId: string,
  options: ShareOptions,
  appUrl: string,
): Promise<ShareResult<ShareState>> {
  const scene = await db.scene.findFirst({
    where: { id: sceneId, ownerId: userId },
  });
  if (!scene) return { ok: false, code: 404, error: "Scene not found" };
  if (scene.status !== "READY") {
    return {
      ok: false,
      code: 409,
      error: "Generate the 3D scene before sharing it",
    };
  }

  const expiresAt =
    options.expiresInDays === null
      ? null
      : new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000);

  const existing = await db.shareLink.findFirst({
    where: { sceneId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });

  // A null password clears it; a non-empty one replaces it.
  const passwordHash =
    options.password === null || options.password === ""
      ? null
      : hashPassword(options.password);

  const link = existing
    ? await db.shareLink.update({
        where: { id: existing.id },
        data: {
          expiresAt,
          // Only touch the hash when the caller said something about it.
          ...(options.password === null && existing.passwordHash !== null
            ? { passwordHash: null }
            : passwordHash
              ? { passwordHash }
              : {}),
        },
      })
    : await db.shareLink.create({
        data: { sceneId, slug: slugFor(), expiresAt, passwordHash },
      });

  await db.scene.update({
    where: { id: sceneId },
    data: { visibility: link.passwordHash ? "PASSWORD" : "UNLISTED" },
  });

  return { ok: true, value: toState(link, appUrl) };
}

/** Kill every live link for the scene. The slug is not reusable afterwards. */
export async function revokeShare(
  sceneId: string,
  userId: string,
): Promise<ShareResult<null>> {
  const scene = await db.scene.findFirst({
    where: { id: sceneId, ownerId: userId },
  });
  if (!scene) return { ok: false, code: 404, error: "Scene not found" };

  await db.$transaction([
    db.shareLink.updateMany({
      where: { sceneId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    db.scene.update({ where: { id: sceneId }, data: { visibility: "PRIVATE" } }),
  ]);

  return { ok: true, value: null };
}

export type ResolvedShare =
  | { state: "missing" }
  | { state: "revoked" }
  | { state: "expired" }
  | { state: "locked"; link: ShareLink }
  | { state: "open"; link: ShareLink };

/**
 * Resolve a slug for the public route. `presentedToken` is the unlock cookie;
 * a password-protected link resolves to `locked` until it matches.
 */
export async function resolveShare(
  slug: string,
  presentedToken: string | undefined,
): Promise<ResolvedShare> {
  const link = await db.shareLink.findUnique({ where: { slug } });
  if (!link) return { state: "missing" };
  if (link.revokedAt) return { state: "revoked" };
  if (link.expiresAt && link.expiresAt < new Date()) return { state: "expired" };

  if (link.passwordHash) {
    return checkUnlockToken(slug, link.passwordHash, presentedToken)
      ? { state: "open", link }
      : { state: "locked", link };
  }
  return { state: "open", link };
}
