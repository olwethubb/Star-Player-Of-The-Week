import { AppValidationError } from './errors';

const AVATAR_SIZE = 150; // px, square
const JPEG_QUALITY = 0.82;
const MAX_BYTES = 150_000; // well under firestore.rules' 200KB cap, with headroom

/** Resizes/crops any image file down to a small square JPEG data URI, entirely
 * client-side — this is what lets avatars live directly on the profile doc
 * instead of needing Cloud Storage. Rejects anything that's still too big after
 * compression rather than silently truncating it. */
export async function fileToAvatarDataUri(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new AppValidationError('Choose an image file.');
  }
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new AppValidationError('Your browser could not process that image.');
  }
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();

  const dataUri = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  if (dataUri.length > MAX_BYTES) {
    throw new AppValidationError('That photo is too complex to compress small enough — try a simpler one.');
  }
  return dataUri;
}
