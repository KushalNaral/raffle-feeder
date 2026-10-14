import { describe, expect, it } from 'vitest';
import { byNumber, normalize, readLocal, toneFor, TONES, writeLocal } from './util';
import { makeTicket } from './test/fixtures';

describe('normalize', () => {
  it('keeps digits only and drops leading zeros', () => {
    expect(normalize(' 0361 ')).toBe('361');
    expect(normalize('No. 42')).toBe('42');
    expect(normalize('000')).toBe('0');
  });

  it('handles empty and nullish input', () => {
    expect(normalize('')).toBe('');
    expect(normalize(null)).toBe('');
    expect(normalize(undefined)).toBe('');
  });
});

describe('toneFor', () => {
  it('is stable and ignores leading zeros', () => {
    expect(toneFor('361')).toBe(toneFor('0361'));
    expect(TONES).toContain(toneFor('7'));
  });

  it('cycles through every tone', () => {
    const seen = new Set(['0', '1', '2', '3', '4'].map(toneFor));
    expect(seen.size).toBe(TONES.length);
  });
});

describe('byNumber', () => {
  it('sorts numerically, then by creation time', () => {
    const a = makeTicket('100', { createdAt: 2 });
    const b = makeTicket('9');
    const c = makeTicket('100', { createdAt: 1 });
    expect([a, b, c].sort(byNumber).map((t) => t.id)).toEqual([b.id, c.id, a.id]);
  });
});

describe('local storage helpers', () => {
  it('round-trips JSON and removes on null', () => {
    writeLocal('k', { a: 1 });
    expect(readLocal('k', null)).toEqual({ a: 1 });
    writeLocal('k', null);
    expect(readLocal('k', 'fallback')).toBe('fallback');
  });

  it('falls back on corrupt data', () => {
    localStorage.setItem('k', '{not json');
    expect(readLocal('k', 5)).toBe(5);
  });
});
