import * as exifr from 'exifr';

/**
 * EXIF Orientation values:
 * 1 = Normal (0°)
 * 3 = Upside down (180°)
 * 6 = Rotated 90° CW (needs -90° rotation to correct)
 * 8 = Rotated 90° CCW (needs 90° rotation to correct)
 * 2, 4, 5, 7 = Mirror/Flip variations (less common)
 */

/**
 * Extract EXIF orientation from an image and convert to rotation degrees
 * Returns 0 if no EXIF data or orientation is normal
 */
export const getExifOrientation = async (file: File): Promise<number> => {
  try {
    const orientation = await exifr(file, { orientation: true });
    
    // Convert EXIF orientation to rotation degrees
    // We want to rotate the image to correct orientation (make it upright)
    switch (orientation) {
      case 1: // Normal (0°)
        return 0;
      case 3: // Upside down (180°)
        return 180;
      case 6: // Rotated 90° CW, needs -90° to correct (rotate CCW)
        return -90;
      case 8: // Rotated 90° CCW, needs 90° to correct (rotate CW)
        return 90;
      case 2: // Normal, flipped horizontally
      case 4: // Upside down, flipped horizontally
      case 5: // Rotated 90° CW, flipped horizontally
      case 7: // Rotated 90° CCW, flipped horizontally
        // For flipped orientations, just correct the rotation, ignore flip
        // Most cameras don't use these, so return 0 as fallback
        return 0;
      default:
        return 0;
    }
  } catch (error) {
    // If EXIF extraction fails, return 0 (no rotation)
    console.warn('EXIF extraction failed:', error);
    return 0;
  }
};

/**
 * Get EXIF orientation from a base64 image string
 */
export const getExifOrientationFromBase64 = async (base64: string): Promise<number> => {
  try {
    // Convert base64 to blob
    const base64Data = base64.split(',')[1] || base64;
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });
    
    // Create a File-like object from blob
    const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
    
    return await getExifOrientation(file);
  } catch (error) {
    console.warn('EXIF extraction from base64 failed:', error);
    return 0;
  }
};
