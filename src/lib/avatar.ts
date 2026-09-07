import "server-only";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import {
  avatarKey,
  deleteObject,
  headObject,
  keyBelongsToUser,
  presignDownload,
  presignUpload,
} from "@/lib/storage";
import { AVATAR_IMAGE_MIME, MAX_AVATAR_BYTES } from "@/lib/upload";

/** Same result shape the rest of `src/lib` uses: HTTP is the route's problem. */
export type AvatarResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: number; error: string };

function isAvatarMime(mime: string | null | undefined): boolean {
  return !!mime && (AVATAR_IMAGE_MIME as readonly string[]).includes(mime);
}

/** Presigned PUT so the browser can upload a new avatar straight to storage. */
export async function presignAvatarUpload(
  user: User,
  input: { filename: string; contentType: string; sizeBytes: number },
): Promise<AvatarResult<{ key: string; uploadUrl: string }>> {
  if (!isAvatarMime(input.contentType)) {
    return { ok: false, code: 415, error: "Use a JPEG, PNG, or WebP image" };
  }
  if (input.sizeBytes > MAX_AVATAR_BYTES) {
    return { ok: false, code: 413, error: "Image is too large" };
  }

  const key = avatarKey(user.id, input.filename);
  const uploadUrl = await presignUpload(key, input.contentType);
  return { ok: true, value: { key, uploadUrl } };
}

/**
 * Record a freshly uploaded avatar: confirm the object landed, swap it in, and
 * bin the previous one. Returns a presigned URL so the caller can show it
 * without a round trip.
 */
export async function confirmAvatarUpload(
  user: User,
  key: string,
): Promise<AvatarResult<{ imageUrl: string }>> {
  if (!keyBelongsToUser(key, user.id)) {
    return { ok: false, code: 400, error: "Key does not belong to you" };
  }

  const head = await headObject(key);
  if (!head) {
    return { ok: false, code: 409, error: "Upload not found in storage" };
  }
  // Trust storage's content type over the client's claim when it has one.
  if (head.contentType && !isAvatarMime(head.contentType)) {
    await deleteObject(key);
    return { ok: false, code: 415, error: "Use a JPEG, PNG, or WebP image" };
  }
  if (head.sizeBytes <= 0 || head.sizeBytes > MAX_AVATAR_BYTES) {
    await deleteObject(key);
    return { ok: false, code: 413, error: "Image is empty or too large" };
  }

  const previous = user.image;
  await db.user.update({ where: { id: user.id }, data: { image: key } });
  if (previous && previous !== key && keyBelongsToUser(previous, user.id)) {
    await deleteObject(previous);
  }

  return { ok: true, value: { imageUrl: await presignDownload(key) } };
}

/** Drop the user's avatar and its storage object. */
export async function removeAvatar(user: User): Promise<AvatarResult<null>> {
  if (!user.image) return { ok: true, value: null };

  await db.user.update({ where: { id: user.id }, data: { image: null } });
  if (keyBelongsToUser(user.image, user.id)) await deleteObject(user.image);
  return { ok: true, value: null };
}
