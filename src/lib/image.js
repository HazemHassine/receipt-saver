import sharp from "sharp";

/**
 * Compress a receipt image for storage.
 * - Resizes to max 1200px wide (preserves aspect ratio)
 * - Converts to JPEG at quality 80
 * - Auto-rotates based on EXIF orientation
 *
 * Typical result: 3-5 MB phone photo → 200-400 KB
 */
export async function compressReceiptImage(buffer) {
  return sharp(buffer)
    .rotate()                   // auto-rotate from EXIF
    .resize(1200, null, {       // max width 1200px, height auto
      fit: "inside",
      withoutEnlargement: true, // don't upscale small images
    })
    .jpeg({ quality: 80 })
    .toBuffer();
}
