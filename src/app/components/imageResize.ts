// Pictures from phones are often 4000 px wide and several MB. Shrinking them in the
// browser keeps the server free of image libraries and the exam download small.
const MAX_SIDE = 1600;
const QUALITY = 0.85;

/** shrinkImage returns the file as is, or re-encoded with its longest side at MAX_SIDE. */
export async function shrinkImage(file: File): Promise<{ blob: Blob; name: string }> {
  // GIFs may be animated; canvas would keep only the first frame.
  if (file.type === 'image/gif' || !file.type.startsWith('image/')) return { blob: file, name: file.name };
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    return { blob: file, name: file.name }; // let the server judge it
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  if (scale === 1) {
    bmp.close();
    return { blob: file, name: file.name };
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  // PNG keeps transparency (diagrams); photos become JPEG.
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, QUALITY));
  if (!blob || blob.size >= file.size) return { blob: file, name: file.name };
  const base = file.name.replace(/\.[^.]+$/, '') || 'gambar';
  return { blob, name: `${base}.${type === 'image/png' ? 'png' : 'jpg'}` };
}
