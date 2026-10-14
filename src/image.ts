// Image helpers: decode (EXIF-aware), rotate, compress, crop for OCR.

import type { Box, Rotation } from './types';

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not open this image.'));
    img.src = src;
  });
}

/** Draw `img` rotated by `rotation` (0/90/180/270) into a canvas no larger than `max` px. */
export function renderRotated(img: HTMLImageElement, rotation: Rotation = 0, max = 1600): HTMLCanvasElement {
  const w0 = img.naturalWidth || img.width;
  const h0 = img.naturalHeight || img.height;
  const scale = Math.min(1, max / Math.max(w0, h0));
  const w = Math.round(w0 * scale);
  const h = Math.round(h0 * scale);
  const swap = rotation % 180 !== 0;
  const c = document.createElement('canvas');
  c.width = swap ? h : w;
  c.height = swap ? w : h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported.');
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  return c;
}

export const canvasToBlob = (canvas: HTMLCanvasElement, quality = 0.82): Promise<Blob> =>
  new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the photo.'))), 'image/jpeg', quality),
  );

/** Crop a normalized box {x,y,w,h} (0..1) out of a canvas, grayscale + contrast stretch for OCR. */
export function cropForOcr(canvas: HTMLCanvasElement, box: Box, targetHeight = 120): HTMLCanvasElement {
  const sx = Math.max(0, Math.round(box.x * canvas.width));
  const sy = Math.max(0, Math.round(box.y * canvas.height));
  const sw = Math.max(8, Math.min(canvas.width - sx, Math.round(box.w * canvas.width)));
  const sh = Math.max(8, Math.min(canvas.height - sy, Math.round(box.h * canvas.height)));
  const scale = targetHeight / sh;
  const out = document.createElement('canvas');
  out.width = Math.max(16, Math.round(sw * scale));
  out.height = targetHeight;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is not supported.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
  const data = ctx.getImageData(0, 0, out.width, out.height);
  const px = data.data;
  let lo = 255;
  let hi = 0;
  const gray = new Uint8ClampedArray(px.length / 4);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const g = 0.299 * (px[i] ?? 0) + 0.587 * (px[i + 1] ?? 0) + 0.114 * (px[i + 2] ?? 0);
    gray[j] = g;
    if (g < lo) lo = g;
    if (g > hi) hi = g;
  }
  const range = Math.max(1, hi - lo);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const v = (((gray[j] ?? 0) - lo) / range) * 255;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(data, 0, 0);
  return out;
}
