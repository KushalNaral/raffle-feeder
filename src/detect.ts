// Find where the ticket number is written, without the user marking it.
//
// Pure pixel code (no DOM) so it runs in the browser and in tests alike:
//   1. shrink the photo and find the ticket: the largest bright, paper-coloured region;
//   2. mark "ink": pixels clearly darker than their surroundings, skipping the warm
//      orange/red print most tickets are decorated with;
//   3. erase long straight rules (the line the number is written on, borders);
//   4. group what's left into words and return them as candidate boxes.
// cropForDigits() then cuts a clean black-on-white image of a box for digit OCR.

import type { Box } from './types';

export interface Pixels {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel. */
  data: Uint8ClampedArray;
}

export interface GrayImage {
  width: number;
  height: number;
  /** One byte per pixel, 0 = black ink, 255 = white. */
  data: Uint8ClampedArray;
}

export interface Candidate {
  /** Where the word sits, normalized to the whole photo. */
  box: Box;
  /** Higher is more number-like; used to decide which candidates to OCR first. */
  score: number;
  /** Blue minus red of the ink, against the paper's: negative for red or orange print. */
  tint: number;
}

const WORK_SIZE = 1000;

interface Work {
  w: number;
  h: number;
  r: Uint8Array;
  g: Uint8Array;
  b: Uint8Array;
  gray: Uint8Array;
}

function shrink(src: Pixels, max: number): Work {
  const scale = Math.min(1, max / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const n = w * h;
  const r = new Uint8Array(n);
  const g = new Uint8Array(n);
  const b = new Uint8Array(n);
  const gray = new Uint8Array(n);
  // Box-average every source pixel into its destination cell.
  const sum = new Float64Array(n * 3);
  const cnt = new Uint32Array(n);
  for (let y = 0; y < src.height; y++) {
    const dy = Math.min(h - 1, Math.floor(y * scale));
    for (let x = 0; x < src.width; x++) {
      const dx = Math.min(w - 1, Math.floor(x * scale));
      const d = dy * w + dx;
      const s = (y * src.width + x) * 4;
      sum[d * 3] = (sum[d * 3] ?? 0) + (src.data[s] ?? 0);
      sum[d * 3 + 1] = (sum[d * 3 + 1] ?? 0) + (src.data[s + 1] ?? 0);
      sum[d * 3 + 2] = (sum[d * 3 + 2] ?? 0) + (src.data[s + 2] ?? 0);
      cnt[d] = (cnt[d] ?? 0) + 1;
    }
  }
  for (let i = 0; i < n; i++) {
    const c = cnt[i] || 1;
    const rv = (sum[i * 3] ?? 0) / c;
    const gv = (sum[i * 3 + 1] ?? 0) / c;
    const bv = (sum[i * 3 + 2] ?? 0) / c;
    r[i] = rv;
    g[i] = gv;
    b[i] = bv;
    gray[i] = 0.299 * rv + 0.587 * gv + 0.114 * bv;
  }
  return { w, h, r, g, b, gray };
}

/** Otsu's threshold over a set of gray values. */
function otsu(values: Uint8Array): number {
  const hist = new Uint32Array(256);
  for (const v of values) hist[v] = (hist[v] ?? 0) + 1;
  const total = values.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * (hist[i] ?? 0);
  let wB = 0;
  let sumB = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t] ?? 0;
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * (hist[t] ?? 0);
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

interface Component {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Pixel count. */
  n: number;
  /** Indices of the pixels, only kept when asked for. */
  px?: number[];
}

/** 8-connected components of a 0/1 mask inside a rectangle. */
function components(mask: Uint8Array, w: number, rect: Rect, keepPixels: boolean): Component[] {
  const seen = new Uint8Array(mask.length);
  const out: Component[] = [];
  const stack: number[] = [];
  for (let y = rect.y0; y < rect.y1; y++) {
    for (let x = rect.x0; x < rect.x1; x++) {
      const start = y * w + x;
      if (!mask[start] || seen[start]) continue;
      const c: Component = { x0: x, y0: y, x1: x, y1: y, n: 0, px: keepPixels ? [] : undefined };
      seen[start] = 1;
      stack.push(start);
      while (stack.length) {
        const i = stack.pop() as number;
        const px = i % w;
        const py = (i - px) / w;
        c.n++;
        c.px?.push(i);
        if (px < c.x0) c.x0 = px;
        if (px > c.x1) c.x1 = px;
        if (py < c.y0) c.y0 = py;
        if (py > c.y1) c.y1 = py;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = py + dy;
          if (ny < rect.y0 || ny >= rect.y1) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = px + dx;
            if ((!dx && !dy) || nx < rect.x0 || nx >= rect.x1) continue;
            const j = ny * w + nx;
            if (mask[j] && !seen[j]) {
              seen[j] = 1;
              stack.push(j);
            }
          }
        }
      }
      out.push(c);
    }
  }
  return out;
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The ticket: the biggest bright, unsaturated region. Falls back to the whole photo. */
function findPaper(im: Work): Rect {
  return paperBlob(im)?.rect ?? { x0: 0, y0: 0, x1: im.w, y1: im.h };
}

/**
 * `tight` cleans thin bright streaks (wood grain) off a ticket lying on a surface, for its
 * true outline. Without it the outline can run on into the surface, which suits ink
 * finding: the ticket's size sets how ink is told apart from paper, tuned on that.
 */
function paperBlob(im: Work, tight = false): { rect: Rect; blob: Component } | null {
  const whole = { x0: 0, y0: 0, x1: im.w, y1: im.h };
  const t = otsu(im.gray);
  const mask = new Uint8Array(im.w * im.h);
  for (let i = 0; i < mask.length; i++) {
    const r = im.r[i] ?? 0;
    const g = im.g[i] ?? 0;
    const b = im.b[i] ?? 0;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    mask[i] = (im.gray[i] ?? 0) > t && sat < 90 ? 1 : 0;
  }
  // Paper is mostly one blob; ink and print punch holes in it but the bounding box survives.
  const blobs = components(mask, im.w, whole, true);
  let best: Component | undefined;
  for (const c of blobs) if (!best || c.n > best.n) best = c;
  if (!best || best.n < im.w * im.h * 0.04) return null;
  if (spansPhoto(best, im)) return ticketOnSurface(im, best, tight);
  return { rect: { x0: best.x0, y0: best.y0, x1: best.x1 + 1, y1: best.y1 + 1 }, blob: best };
}

/** Running edge to edge, a bright region is the desk or table the ticket lies on. */
const spansPhoto = (c: Component, im: Work): boolean =>
  (c.x0 <= 1 && c.x1 >= im.w - 2) || (c.y0 <= 1 && c.y1 >= im.h - 2);

/**
 * A ticket lying on a light surface: the paper is the brighter part of it. Split the
 * surface's own brightness range and keep the biggest bright blob clear of the edges.
 */
function ticketOnSurface(im: Work, surface: Component, tight: boolean): { rect: Rect; blob: Component } | null {
  const whole = { x0: 0, y0: 0, x1: im.w, y1: im.h };
  const px = surface.px ?? [];
  const values = new Uint8Array(px.length);
  px.forEach((i, k) => (values[k] = im.gray[i] ?? 0));
  const t = otsu(values);
  let mask = new Uint8Array(im.w * im.h);
  for (const i of px) mask[i] = (im.gray[i] ?? 0) > t ? 1 : 0;
  if (tight) {
    // Bright streaks of wood grain touch the ticket's edge; thin ones don't survive this.
    const r = Math.max(2, Math.round(Math.min(im.w, im.h) * 0.006));
    mask = grow(grow(mask, im.w, im.h, r, true), im.w, im.h, r, false);
  }
  let best: Component | undefined;
  for (const c of components(mask, im.w, whole, true))
    if (!spansPhoto(c, im) && (!best || c.n > best.n)) best = c;
  if (!best || best.n < im.w * im.h * 0.01) return null;
  return { rect: { x0: best.x0, y0: best.y0, x1: best.x1 + 1, y1: best.y1 + 1 }, blob: best };
}

/**
 * Square-window morphology on a 0/1 mask: `shrink` keeps a pixel only if its whole
 * (2r+1)² window is set (erosion); otherwise any set pixel in the window sets it (dilation).
 */
function grow(mask: Uint8Array, w: number, h: number, r: number, shrink: boolean): Uint8Array {
  const iw = w + 1;
  const sum = new Uint32Array(iw * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += mask[y * w + x] ?? 0;
      sum[(y + 1) * iw + x + 1] = (sum[y * iw + x + 1] ?? 0) + row;
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const ya = Math.max(0, y - r);
    const yb = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const xa = Math.max(0, x - r);
      const xb = Math.min(w, x + r + 1);
      const n =
        (sum[yb * iw + xb] ?? 0) - (sum[ya * iw + xb] ?? 0) - (sum[yb * iw + xa] ?? 0) + (sum[ya * iw + xa] ?? 0);
      out[y * w + x] = shrink ? (n === (yb - ya) * (xb - xa) ? 1 : 0) : n > 0 ? 1 : 0;
    }
  }
  return out;
}

/** Ink mask inside the ticket, with straight rules removed unless asked to keep them. */
function findInk(im: Work, paper: Rect, keepRules = false): Uint8Array {
  const { w } = im;
  const pw = paper.x1 - paper.x0;
  const ph = paper.y1 - paper.y0;
  // Integral image for local means.
  const iw = w + 1;
  const integral = new Float64Array(iw * (im.h + 1));
  for (let y = 0; y < im.h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += im.gray[y * w + x] ?? 0;
      integral[(y + 1) * iw + x + 1] = (integral[y * iw + x + 1] ?? 0) + row;
    }
  }
  const half = Math.max(4, Math.round(Math.min(pw, ph) / 12));
  const ink = new Uint8Array(w * im.h);
  for (let y = paper.y0; y < paper.y1; y++) {
    const ya = Math.max(paper.y0, y - half);
    const yb = Math.min(paper.y1, y + half + 1);
    for (let x = paper.x0; x < paper.x1; x++) {
      const xa = Math.max(paper.x0, x - half);
      const xb = Math.min(paper.x1, x + half + 1);
      const area = (yb - ya) * (xb - xa);
      const s =
        (integral[yb * iw + xb] ?? 0) -
        (integral[ya * iw + xb] ?? 0) -
        (integral[yb * iw + xa] ?? 0) +
        (integral[ya * iw + xa] ?? 0);
      const mean = s / area;
      const i = y * w + x;
      const v = im.gray[i] ?? 0;
      const r = im.r[i] ?? 0;
      const b = im.b[i] ?? 0;
      const sat = Math.max(r, im.g[i] ?? 0, b) - Math.min(r, im.g[i] ?? 0, b);
      // Warm, saturated print (orange banners, red logos) isn't handwriting.
      const warm = r - b > 50 && sat > 70;
      ink[i] = v < mean * 0.78 && v < 170 && !warm ? 1 : 0;
    }
  }
  if (keepRules) return ink;
  // Erase long horizontal and vertical runs: writing lines, underlines, borders.
  const maxH = Math.max(12, Math.round(pw * 0.09));
  for (let y = paper.y0; y < paper.y1; y++) {
    let run = 0;
    for (let x = paper.x0; x <= paper.x1; x++) {
      const on = x < paper.x1 && ink[y * w + x];
      if (on) run++;
      else {
        if (run > maxH) for (let k = x - run; k < x; k++) ink[y * w + k] = 0;
        run = 0;
      }
    }
  }
  const maxV = Math.max(12, Math.round(ph * 0.4));
  for (let x = paper.x0; x < paper.x1; x++) {
    let run = 0;
    for (let y = paper.y0; y <= paper.y1; y++) {
      const on = y < paper.y1 && ink[y * w + x];
      if (on) run++;
      else {
        if (run > maxV) for (let k = y - run; k < y; k++) ink[k * w + x] = 0;
        run = 0;
      }
    }
  }
  return ink;
}

interface Word {
  rect: Rect;
  parts: Component[];
}

/** Merge glyph-sized components into words: same line, small gaps. */
function groupWords(glyphs: Component[]): Word[] {
  const sorted = [...glyphs].sort((a, b) => a.x0 - b.x0);
  const words: Word[] = [];
  for (const c of sorted) {
    const ch = c.y1 - c.y0 + 1;
    let home: Word | undefined;
    for (const wd of words) {
      const r = wd.rect;
      const wh = r.y1 - r.y0 + 1;
      const overlap = Math.min(r.y1, c.y1) - Math.max(r.y0, c.y0) + 1;
      const gap = c.x0 - r.x1;
      if (overlap >= 0.45 * Math.min(wh, ch) && gap <= 0.6 * Math.max(wh, ch) && gap > -Math.max(wh, ch)) {
        home = wd;
        break;
      }
    }
    if (home) {
      const r = home.rect;
      r.x0 = Math.min(r.x0, c.x0);
      r.y0 = Math.min(r.y0, c.y0);
      r.x1 = Math.max(r.x1, c.x1);
      r.y1 = Math.max(r.y1, c.y1);
      home.parts.push(c);
    } else words.push({ rect: { x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 }, parts: [c] });
  }
  return words;
}

const grayAt = (photo: Pixels, x: number, y: number): number => {
  const i = (y * photo.width + x) * 4;
  const r = photo.data[i] ?? 255;
  const g = photo.data[i + 1] ?? 255;
  const b = photo.data[i + 2] ?? 255;
  // Brightest channel: tinted paper and coloured print read as light, pen ink stays dark.
  return Math.max(r, g, b);
};

/**
 * Cut a word out of the full-resolution photo, upscale it smoothly so the text is
 * `target` px tall, then binarize and drop any ruled line running under it.
 */
export interface CropOptions {
  /** Height the text is scaled to, in px. */
  target?: number;
  /** Extra room around the box, as a fraction of its height. */
  margin?: number;
}

export function cropForDigits(photo: Pixels, box: Box, { target = 64, margin = 0.15 }: CropOptions = {}): GrayImage {
  const bx = box.x * photo.width;
  const by = box.y * photo.height;
  const bw = box.w * photo.width;
  const bh = box.h * photo.height;
  const m = bh * margin;
  const sx0 = Math.max(0, bx - m);
  const sy0 = Math.max(0, by - m);
  const sx1 = Math.min(photo.width - 1, bx + bw + m);
  const sy1 = Math.min(photo.height - 1, by + bh + m);
  const scale = target / Math.max(1, bh);
  const cw = Math.max(8, Math.round((sx1 - sx0) * scale));
  const ch = Math.max(8, Math.round((sy1 - sy0) * scale));
  const gray = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    const fy = Math.min(sy1, sy0 + y / scale);
    const y0 = Math.floor(fy);
    const y1 = Math.min(photo.height - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < cw; x++) {
      const fx = Math.min(sx1, sx0 + x / scale);
      const x0 = Math.floor(fx);
      const x1 = Math.min(photo.width - 1, x0 + 1);
      const tx = fx - x0;
      const top = grayAt(photo, x0, y0) * (1 - tx) + grayAt(photo, x1, y0) * tx;
      const bot = grayAt(photo, x0, y1) * (1 - tx) + grayAt(photo, x1, y1) * tx;
      gray[y * cw + x] = top * (1 - ty) + bot * ty;
    }
  }
  const t = otsu(gray);
  const ink = new Uint8Array(cw * ch);
  for (let i = 0; i < ink.length; i++) ink[i] = (gray[i] ?? 255) < t ? 1 : 0;
  // A run of ink much wider than a digit is the writing line, not the number.
  const maxRun = Math.round(target * 1.2);
  for (let y = 0; y < ch; y++) {
    let run = 0;
    for (let x = 0; x <= cw; x++) {
      if (x < cw && ink[y * cw + x]) run++;
      else {
        if (run > maxRun) ink.fill(0, y * cw + x - run, y * cw + x);
        run = 0;
      }
    }
  }
  const pad = Math.round(target * 0.4);
  const ow = cw + pad * 2;
  const oh = ch + pad * 2;
  const data = new Uint8ClampedArray(ow * oh).fill(255);
  for (let y = 0; y < ch; y++)
    for (let x = 0; x < cw; x++) if (ink[y * cw + x]) data[(y + pad) * ow + x + pad] = 0;
  return { width: ow, height: oh, data };
}

/**
 * Split a shape into what stands above a thin line through it: columns holding no more
 * than `thin` pixels are only line, so they're dropped and the rest regrouped.
 */
function cutLine(c: Component, w: number, thin: number): Component[] {
  const cw = c.x1 - c.x0 + 1;
  const ch = c.y1 - c.y0 + 1;
  const counts = new Uint32Array(cw);
  for (const i of c.px ?? []) counts[(i % w) - c.x0] = (counts[(i % w) - c.x0] ?? 0) + 1;
  const local = new Uint8Array(cw * ch);
  for (const i of c.px ?? []) {
    const x = (i % w) - c.x0;
    if ((counts[x] ?? 0) > thin) local[(Math.floor(i / w) - c.y0) * cw + x] = 1;
  }
  return components(local, cw, { x0: 0, y0: 0, x1: cw, y1: ch }, true).map((p) => ({
    x0: p.x0 + c.x0,
    y0: p.y0 + c.y0,
    x1: p.x1 + c.x0,
    y1: p.y1 + c.y0,
    n: p.n,
    px: (p.px ?? []).map((j) => (Math.floor(j / cw) + c.y0) * w + (j % cw) + c.x0),
  }));
}

/** Where the ticket is in a photo, normalized; null when no ticket stands out. */
export function findTicket(photo: Pixels): Box | null {
  const im = shrink(photo, WORK_SIZE);
  const found = paperBlob(im, true);
  if (!found) return null;
  const { x0, y0, x1, y1 } = found.rect;
  return { x: x0 / im.w, y: y0 / im.h, w: (x1 - x0) / im.w, h: (y1 - y0) / im.h };
}

/**
 * Candidate number locations in a photo, most promising first. `within` keeps only
 * candidates it accepts, before the limit is applied.
 */
export function findCandidates(photo: Pixels, limit = 8, within?: (box: Box) => boolean): Candidate[] {
  const im = shrink(photo, WORK_SIZE);
  const paper = findPaper(im);
  const ink = findInk(im, paper);
  const pw = paper.x1 - paper.x0;
  const ph = paper.y1 - paper.y0;
  // On a found ticket the number is a sizeable fraction of its height; on the whole
  // photo (no ticket found) it can be much smaller.
  const foundTicket = pw < im.w || ph < im.h;
  const minH = Math.max(5, ph * (foundTicket ? 0.035 : 0.012));
  const maxH = ph * 0.3;

  const isGlyph = (c: Component): boolean => {
    const ch = c.y1 - c.y0 + 1;
    const cw = c.x1 - c.x0 + 1;
    // Flat slivers are leftovers of ruled lines; they'd glue the label to the number.
    return c.n >= 6 && ch >= minH && ch <= maxH && cw <= pw * 0.25 && cw / ch <= 4;
  };
  const thin = Math.max(2, Math.round(ph * 0.012));
  const glyphs = components(ink, im.w, paper, true).flatMap((c) => {
    // No digit is twice as wide as it is tall: a shape that is has run into a line,
    // usually a slanted one the run eraser missed. Cut the line away.
    const wide = c.x1 - c.x0 + 1 > 2 * (c.y1 - c.y0 + 1);
    return (wide ? cutLine(c, im.w, thin) : [c]).filter(isGlyph);
  });

  const words = groupWords(glyphs).filter((wd) => {
    const ww = wd.rect.x1 - wd.rect.x0 + 1;
    const wh = wd.rect.y1 - wd.rect.y0 + 1;
    return wh >= minH && ww / wh >= 0.3 && ww / wh <= 9 && wd.parts.length <= 10;
  });

  // The paper's own cast (warm lamp light, cream stock), so ink colour is judged against it.
  let paperTint = 0;
  let paperN = 0;
  for (let y = paper.y0; y < paper.y1; y += 3)
    for (let x = paper.x0; x < paper.x1; x += 3) {
      const i = y * im.w + x;
      if (ink[i]) continue;
      paperTint += (im.b[i] ?? 0) - (im.r[i] ?? 0);
      paperN++;
    }
  paperTint /= paperN || 1;

  const scored = words.map((wd) => {
    const r = wd.rect;
    const wh = r.y1 - r.y0 + 1;
    const ww = r.x1 - r.x0 + 1;
    // Ink colour: ballpoint blue/black scores above printed grey or colour.
    let blue = 0;
    let dark = 0;
    let n = 0;
    for (const c of wd.parts)
      for (const i of c.px ?? []) {
        blue += (im.b[i] ?? 0) - (im.r[i] ?? 0);
        dark += 255 - (im.gray[i] ?? 0);
        n++;
      }
    const inkCount = n || 1;
    const density = n / (ww * wh);
    const score =
      (wh / ph) * 10 + // bigger writing first
      Math.min(1, Math.max(0, blue / inkCount / 40)) + // bluish ink
      (dark / inkCount / 255) * 0.5 +
      (density > 0.08 && density < 0.6 ? 0.5 : 0) +
      (wd.parts.length >= 2 && wd.parts.length <= 6 ? 0.5 : 0);
    const box = { x: r.x0 / im.w, y: r.y0 / im.h, w: (r.x1 - r.x0 + 1) / im.w, h: (r.y1 - r.y0 + 1) / im.h };
    return { box, score, tint: blue / inkCount - paperTint };
  });

  return scored
    .filter((c) => !within || within(c.box))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}


/** Turn a photo clockwise by a quarter-turn multiple. */
export function rotatePixels(photo: Pixels, rotation: 0 | 90 | 180 | 270): Pixels {
  if (rotation === 0) return photo;
  const { width: w, height: h } = photo;
  const swap = rotation !== 180;
  const ow = swap ? h : w;
  const oh = swap ? w : h;
  const data = new Uint8ClampedArray(ow * oh * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [nx, ny] = rotation === 90 ? [h - 1 - y, x] : rotation === 180 ? [w - 1 - x, h - 1 - y] : [y, w - 1 - x];
      const s = (y * w + x) * 4;
      const d = (ny * ow + nx) * 4;
      data[d] = photo.data[s] ?? 0;
      data[d + 1] = photo.data[s + 1] ?? 0;
      data[d + 2] = photo.data[s + 2] ?? 0;
      data[d + 3] = photo.data[s + 3] ?? 255;
    }
  return { width: ow, height: oh, data };
}

/**
 * How far the ticket is tilted, in degrees (positive = clockwise), from the long axis
 * of the paper's outline. Perspective can throw this off by a couple of degrees.
 * Returns 0 when there's no clear oblong ticket to go by.
 */
export function estimateSkew(photo: Pixels, maxDeg = 20): number {
  const im = shrink(photo, 600);
  const found = paperBlob(im);
  if (!found) return 0;
  const px = found.blob.px ?? [];
  let mx = 0;
  let my = 0;
  for (const i of px) {
    mx += i % im.w;
    my += Math.floor(i / im.w);
  }
  mx /= px.length;
  my /= px.length;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const i of px) {
    const dx = (i % im.w) - mx;
    const dy = Math.floor(i / im.w) - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  // Eigenvalues of the covariance: a square-ish blob has no meaningful long axis.
  const tr = sxx + syy;
  const det = sxx * syy - sxy * sxy;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const big = tr / 2 + disc;
  const small = tr / 2 - disc;
  if (small <= 0 || big / small < 1.6) return 0;
  let deg = (0.5 * Math.atan2(2 * sxy, sxx - syy) * 180) / Math.PI;
  // A ticket held portrait: its long axis is near vertical; measure from that instead.
  if (deg > 45) deg -= 90;
  else if (deg < -45) deg += 90;
  if (Math.abs(deg) > maxDeg) return 0;
  return Math.round(deg * 10) / 10;
}

/** Turn a photo by any angle (degrees, clockwise), keeping its size. Corners fill black. */
export function rotatePixelsBy(photo: Pixels, deg: number): Pixels {
  const { width: w, height: h } = photo;
  const a = (deg * Math.PI) / 180;
  const sin = Math.sin(a);
  const cos = Math.cos(a);
  const cx = w / 2;
  const cy = h / 2;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      // Sample where this output pixel came from, blending the four nearest pixels.
      const dx = x - cx;
      const dy = y - cy;
      const fx = cx + dx * cos + dy * sin;
      const fy = cy - dx * sin + dy * cos;
      const d = (y * w + x) * 4;
      data[d + 3] = 255;
      if (fx < 0 || fy < 0 || fx > w - 1 || fy > h - 1) continue;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(w - 1, x0 + 1);
      const y1 = Math.min(h - 1, y0 + 1);
      const tx = fx - x0;
      const ty = fy - y0;
      for (let k = 0; k < 3; k++) {
        const at = (px: number, py: number) => photo.data[(py * w + px) * 4 + k] ?? 0;
        const top = at(x0, y0) * (1 - tx) + at(x1, y0) * tx;
        const bot = at(x0, y1) * (1 - tx) + at(x1, y1) * tx;
        data[d + k] = top * (1 - ty) + bot * ty;
      }
    }
  return { width: w, height: h, data };
}
