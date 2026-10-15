// The spot on a ticket where its number is written, remembered between batches.
// It's kept relative to the ticket rather than the photo, so it still lands on the
// number when the next ticket is photographed closer, further away or off-centre.

import { readLocal, writeLocal } from './util';
import type { Box } from './types';

const KEY = 'rf:number-spot';
const WHOLE: Box = { x: 0, y: 0, w: 1, h: 1 };

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/** A box on the photo, as a fraction of the ticket it's on (or the photo, with no ticket). */
export function toTicket(box: Box, ticket: Box | null): Box {
  const t = ticket ?? WHOLE;
  return { x: (box.x - t.x) / t.w, y: (box.y - t.y) / t.h, w: box.w / t.w, h: box.h / t.h };
}

/** Back from the ticket onto the photo, kept inside the photo. */
export function fromTicket(spot: Box, ticket: Box | null): Box {
  const t = ticket ?? WHOLE;
  const x0 = clamp(t.x + spot.x * t.w);
  const y0 = clamp(t.y + spot.y * t.h);
  const x1 = clamp(t.x + (spot.x + spot.w) * t.w);
  const y1 = clamp(t.y + (spot.y + spot.h) * t.h);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const isBox = (v: unknown): v is Box =>
  !!v && typeof v === 'object' && ['x', 'y', 'w', 'h'].every((k) => Number.isFinite((v as Record<string, unknown>)[k]));

export const loadSpot = (): Box | null => {
  const v = readLocal<unknown>(KEY, null);
  return isBox(v) && v.w > 0 && v.h > 0 ? v : null;
};
export const saveSpot = (spot: Box | null): void => writeLocal(KEY, spot);
