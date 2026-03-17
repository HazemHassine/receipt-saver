import { Storage } from "@google-cloud/storage";

let _storage;
let _bucket;

function getBucket() {
  if (!_bucket) {
    _storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });
    _bucket = _storage.bucket(process.env.GOOGLE_CLOUD_STORAGE_BUCKET);
  }
  return _bucket;
}

/**
 * Upload a file buffer to Cloud Storage.
 * Returns the GCS path (gs://bucket/path).
 */
export async function uploadReceiptImage(userId, fileName, buffer, mimeType) {
  const path = `users/${userId}/receipts/${Date.now()}-${fileName}`;
  const file = getBucket().file(path);

  await file.save(buffer, {
    metadata: { contentType: mimeType },
    resumable: false,
  });

  return {
    path,
    gcsUri: `gs://${process.env.GOOGLE_CLOUD_STORAGE_BUCKET}/${path}`,
  };
}

/**
 * Generate a short-lived signed URL for reading a receipt image.
 */
export async function getSignedUrl(filePath) {
  const file = getBucket().file(filePath);
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
  });
  return url;
}

/**
 * Delete a file from Cloud Storage.
 */
export async function deleteFile(filePath) {
  const file = getBucket().file(filePath);
  await file.delete({ ignoreNotFound: true });
}
