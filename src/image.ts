// Image helpers: decode (EXIF-aware), rotate, compress.

import type { Rotation } from './types';

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
