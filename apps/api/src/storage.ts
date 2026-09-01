// Firebase Storage helpers. Uploads use browser-direct V4-signed PUT URLs
// (the bytes never transit the API server); downloads get fresh signed GET
// URLs generated at read time, so nothing stale is persisted.

import { firebaseStorage } from "./_core/firebase";

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function bucket() {
  const storage = firebaseStorage();
  const name = process.env.FIREBASE_STORAGE_BUCKET;
  if (!name) {
    throw new Error("Storage config missing: set FIREBASE_STORAGE_BUCKET");
  }
  return storage.bucket(name);
}

/**
 * Presigns a PUT URL for browser-direct uploads. The returned key carries a
 * hash suffix so the caller can register it deterministically.
 */
export async function storagePresignPutUrl(
  relKey: string,
  contentType: string,
): Promise<{ key: string; uploadUrl: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const [uploadUrl] = await bucket().file(key).getSignedUrl({
    action: "write",
    version: "v4",
    expires: Date.now() + 15 * 60 * 1000,
    contentType,
  });
  return { key, uploadUrl };
}

/** Server-side upload fallback for the base64 flow (small files). */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array,
  contentType = "application/octet-stream",
): Promise<{ key: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  await bucket().file(key).save(data, { contentType });
  return { key };
}

/**
 * Fresh signed download URL for a stored object. Called when serving task
 * detail so links never expire while a user is looking at them.
 */
export async function storageGetSignedUrl(storageKey: string): Promise<string> {
  const [url] = await bucket().file(normalizeKey(storageKey)).getSignedUrl({
    action: "read",
    version: "v4",
    expires: Date.now() + 60 * 60 * 1000,
  });
  return url;
}
