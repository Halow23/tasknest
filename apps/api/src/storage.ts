// Firebase Storage helpers. In production uploads use browser-direct V4-signed
// PUT URLs (the bytes never transit the API server) and downloads get fresh
// signed GET URLs generated at read time, so nothing stale is persisted.
//
// V4 signing needs a service-account private key, which the Storage emulator
// does not have (and it ignores signatures anyway). Against the emulator the
// helpers therefore fall back to Admin-SDK access, which bypasses the deny-all
// Storage rules: presign reports that direct upload is unavailable so the
// client relays bytes through the server, and downloads use Firebase download
// tokens instead of signatures.

import { firebaseStorage } from "./_core/firebase";

/** Emulator host (`localhost:9199`) when the Storage emulator is in use. */
function emulatorHost(): string | null {
  const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? process.env.STORAGE_EMULATOR_HOST;
  return host ? host.replace(/^https?:\/\//, "") : null;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function bucketName(): string {
  const name = process.env.FIREBASE_STORAGE_BUCKET;
  if (!name) {
    throw new Error("Storage config missing: set FIREBASE_STORAGE_BUCKET");
  }
  return name;
}

function bucket() {
  return firebaseStorage().bucket(bucketName());
}

/**
 * Presigns a PUT URL for browser-direct uploads. The returned key carries a
 * hash suffix so the caller can register it deterministically. Returns a null
 * uploadUrl against the emulator, where signing is unavailable — the caller
 * then falls back to the server-relayed upload path.
 */
export async function storagePresignPutUrl(
  relKey: string,
  contentType: string,
): Promise<{ key: string; uploadUrl: string | null }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  if (emulatorHost()) return { key, uploadUrl: null };
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
  const key = normalizeKey(storageKey);
  const host = emulatorHost();
  if (host) {
    // The emulator cannot verify signatures; a Firebase download token is the
    // equivalent unguessable capability it does understand.
    const file = bucket().file(key);
    const [metadata] = await file.getMetadata();
    let token = (metadata.metadata as Record<string, string> | undefined)?.firebaseStorageDownloadTokens;
    if (!token) {
      token = crypto.randomUUID();
      await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
    }
    return `http://${host}/v0/b/${encodeURIComponent(bucketName())}/o/${encodeURIComponent(key)}?alt=media&token=${token}`;
  }
  const [url] = await bucket().file(key).getSignedUrl({
    action: "read",
    version: "v4",
    expires: Date.now() + 60 * 60 * 1000,
  });
  return url;
}
