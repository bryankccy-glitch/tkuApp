/**
 * Downscale a photo/screenshot to a JPEG data URL small enough to upload (and re-encoding
 * strips EXIF such as GPS). Timetable text stays readable at ~2000px on the long side.
 */
export async function fileToJpegDataUrl(file: Blob, maxSide = 2000, maxChars = 3_500_000): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    for (const [side, quality] of [[maxSide, 0.88], [maxSide, 0.75], [1600, 0.75], [1280, 0.7]] as const) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas unavailable');
      ctx.fillStyle = '#fff'; // transparent PNGs → white, not black
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL('image/jpeg', quality);
      if (url.length <= maxChars) return url;
    }
    throw new Error('image too large');
  } finally {
    bitmap.close();
  }
}
