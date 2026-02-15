import heic2any from 'heic2any';

const HEIC_TYPES = ['image/heic', 'image/heif'];
const HEIC_EXT = /\.(heic|heif)$/i;

/**
 * Convert HEIC/HEIF (e.g. from iPhone) to JPEG before extraction.
 * Returns the original file if not HEIC. Server-side Sharp cannot decode HEIC.
 */
export async function heicToJpegIfNeeded(file: File): Promise<File> {
  const isHeic = HEIC_TYPES.includes(file.type) || HEIC_EXT.test(file.name);
  if (!isHeic) return file;

  try {
    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92,
    });
    const blob = Array.isArray(result) ? result[0] : result;
    if (!blob || typeof blob.size !== 'number') throw new Error('HEIC conversion failed');
    const outName = (file.name || 'photo').replace(HEIC_EXT, '.jpg');
    return new File([blob], outName, { type: 'image/jpeg' });
  } catch (e) {
    throw new Error('HEIC/HEIF format not supported. Please use JPG or PNG, or convert your photos in Settings before uploading.');
  }
}
