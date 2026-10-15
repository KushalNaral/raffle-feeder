import { beforeEach, describe, expect, it } from 'vitest';
import { fromTicket, loadSpot, saveSpot, toTicket } from './spot';

describe('number spot', () => {
  beforeEach(() => localStorage.clear());

  it('follows the ticket to wherever it is in the next photo', () => {
    // Marked on a ticket filling the middle of one photo...
    const spot = toTicket({ x: 0.5, y: 0.6, w: 0.1, h: 0.05 }, { x: 0.1, y: 0.4, w: 0.8, h: 0.4 });
    expect(spot.x).toBeCloseTo(0.5);
    expect(spot.y).toBeCloseTo(0.5);
    // ...lands on the same part of a smaller ticket off to the right in the next.
    const next = fromTicket(spot, { x: 0.5, y: 0.2, w: 0.4, h: 0.2 });
    expect(next.x).toBeCloseTo(0.7);
    expect(next.y).toBeCloseTo(0.3);
    expect(next.w).toBeCloseTo(0.05);
    expect(next.h).toBeCloseTo(0.025);
  });

  it('uses the whole photo when no ticket stands out', () => {
    const back = fromTicket(toTicket({ x: 0.2, y: 0.3, w: 0.1, h: 0.1 }, null), null);
    expect([back.x, back.y, back.w, back.h].map((v) => v.toFixed(6))).toEqual(['0.200000', '0.300000', '0.100000', '0.100000']);
  });

  it('keeps the spot inside the photo', () => {
    const b = fromTicket({ x: 0.9, y: -0.2, w: 0.4, h: 0.4 }, null);
    expect(b.x + b.w).toBeLessThanOrEqual(1);
    expect(b.y).toBeGreaterThanOrEqual(0);
  });

  it('is remembered, and can be forgotten', () => {
    expect(loadSpot()).toBeNull();
    saveSpot({ x: 0.1, y: 0.2, w: 0.3, h: 0.1 });
    expect(loadSpot()).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.1 });
    saveSpot(null);
    expect(loadSpot()).toBeNull();
  });

  it('ignores anything stored that isn’t a spot', () => {
    localStorage.setItem('rf:number-spot', JSON.stringify({ x: 'a' }));
    expect(loadSpot()).toBeNull();
    localStorage.setItem('rf:number-spot', 'not json');
    expect(loadSpot()).toBeNull();
  });
});
