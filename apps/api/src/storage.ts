/**
 * Cloudinary storage helpers. Replaces the Firebase Storage implementation.
 *
 * Upload flow:
 *   presign  → returns a signed upload URL (browser PUTs bytes directly to Cloudinary)
 *   register → stores the Cloudinary publicId + secure_url in Firestore
 *   upload   → server-side fallback for the base64 path (small files)
 *
 * Download: Cloudinary URLs don't expire by default (they're CDN-served), so
 * storageGetUrl just returns the stored cloudinaryUrl directly — no re-signing
 * needed at read time. For private/authenticated delivery, sign the URL.
 *
 * Config env vars:
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 */

import { v2 as cloudinary } from "cloudinary";

let configured = false;

function getCloudinary() {
  if (!configured) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error(
        "Cloudinary config missing: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET",
      );
    }
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    configured = true;
  }
  return cloudinary;
}

/**
 * Build a deterministic Cloudinary public_id from a storage path.
 * e.g. "tasknest/ws1/tasks/t2/report.pdf" → "tasknest/ws1/tasks/t2/report_<hash>"
 * (Cloudinary strips the extension from the public_id when using resource_type=raw)
 */
function buildPublicId(relPath: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relPath.lastIndexOf(".");
  const base = lastDot === -1 ? relPath : relPath.slice(0, lastDot);
  return `${base.replace(/^\/+/, "")}_${hash}`;
}

/**
 * Presign a browser-direct upload URL.
 * Returns the signed upload params for the client to POST to Cloudinary's
 * upload endpoint (unsigned uploads are disabled by default for security).
 *
 * The client should:
 *   POST https://api.cloudinary.com/v1_1/{cloud_name}/raw/upload
 *   with { api_key, timestamp, signature, public_id, folder, file }
 */
export async function storagePresignPutUrl(
  relKey: string,
  _contentType: string,
): Promise<{
  key: string;           // publicId (stored in Firestore for download)
  uploadUrl: string;     // Cloudinary upload endpoint
  uploadParams: Record<string, string | number>;  // signed params
}> {
  const cld = getCloudinary();
  const publicId = buildPublicId(relKey);
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { public_id: publicId, timestamp, resource_type: "raw" };
  const signature = cld.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET!);
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  return {
    key: publicId,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
    uploadParams: {
      api_key: process.env.CLOUDINARY_API_KEY!,
      timestamp,
      signature,
      public_id: publicId,
    },
  };
}

/** Server-side upload fallback for the base64 path (files ≤5 MB). */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const cld = getCloudinary();
  const publicId = buildPublicId(relKey);
  const dataUri = `data:${contentType};base64,${Buffer.from(data).toString("base64")}`;
  const result = await cld.uploader.upload(dataUri, {
    public_id: publicId,
    resource_type: "raw",
    overwrite: false,
  });
  return { key: result.public_id, url: result.secure_url };
}

/**
 * Return the download URL for a stored object.
 * Cloudinary URLs are permanent CDN links — no signing needed.
 * Pass the cloudinaryUrl stored on the attachment doc.
 */
export function storageGetUrl(cloudinaryUrl: string): string {
  return cloudinaryUrl;
}

/**
 * Delete an object from Cloudinary (used when an attachment is hard-deleted).
 */
export async function storageDelete(publicId: string): Promise<void> {
  const cld = getCloudinary();
  await cld.uploader.destroy(publicId, { resource_type: "raw" });
}
