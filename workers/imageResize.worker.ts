/**
 * Web Worker: resize image to max dimension and re-encode as JPEG.
 * Offloads heavy decode/draw/encode from main thread so mobile UI stays responsive.
 */

const DEFAULT_MAX_DIM = 2048;
const DEFAULT_QUALITY = 0.88;
const DEFAULT_SIZE_THRESHOLD = 1.2 * 1024 * 1024; // 1.2MB

type ResizeRequest = {
  id: string;
  arrayBuffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
  maxDim?: number;
  quality?: number;
  sizeThreshold?: number;
};

type ResizeResponse =
  | { id: string; arrayBuffer: ArrayBuffer; fileName: string; error?: undefined }
  | { id: string; error: string };

self.onmessage = async (e: MessageEvent<ResizeRequest>) => {
  const {
    id,
    arrayBuffer,
    fileName,
    mimeType,
    maxDim = DEFAULT_MAX_DIM,
    quality = DEFAULT_QUALITY,
    sizeThreshold = DEFAULT_SIZE_THRESHOLD,
  } = e.data;

  try {
    const blob = new Blob([arrayBuffer], { type: mimeType || 'image/jpeg' });
    const needResize =
      arrayBuffer.byteLength > sizeThreshold ||
      (await checkDimensions(blob, maxDim));

    if (!needResize) {
      self.postMessage({ id, arrayBuffer, fileName } as ResizeResponse);
      return;
    }

    const bitmap = await createImageBitmap(blob);
    const w = bitmap.width;
    const h = bitmap.height;
    const scale = Math.min(1, maxDim / w, maxDim / h);
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);

    const canvas = new OffscreenCanvas(cw, ch);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      self.postMessage({ id, arrayBuffer, fileName } as ResizeResponse);
      return;
    }
    ctx.drawImage(bitmap, 0, 0, cw, ch);
    bitmap.close();

    const outBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    if (!outBlob) {
      self.postMessage({ id, arrayBuffer, fileName } as ResizeResponse);
      return;
    }

    const outBuffer = await outBlob.arrayBuffer();
    const outName = fileName.replace(/\.[a-z]+$/i, '.jpg');
    self.postMessage(
      { id, arrayBuffer: outBuffer, fileName: outName } as ResizeResponse,
      [outBuffer]
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Resize failed';
    self.postMessage({ id, error: message } as ResizeResponse);
  }
};

async function checkDimensions(blob: Blob, maxDim: number): Promise<boolean> {
  const bitmap = await createImageBitmap(blob);
  const ok = bitmap.width <= maxDim && bitmap.height <= maxDim;
  bitmap.close();
  return !ok;
}
