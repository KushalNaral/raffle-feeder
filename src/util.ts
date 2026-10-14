import type { Ticket } from './types';

export const normalize = (n: unknown): string =>
  String(n ?? '')
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '');

export const uid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const TONES = ['coral', 'cobalt', 'lime', 'tangerine', 'bubblegum'] as const;
export type Tone = (typeof TONES)[number];
export const toneFor = (number: string): Tone => {
  const n = parseInt(normalize(number) || '0', 10);
  return TONES[n % TONES.length] as Tone;
};

export const fmtDate = (ts: number | null | undefined): string =>
  ts ? new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
export const fmtTime = (ts: number | null | undefined): string =>
  ts ? new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';

export const byNumber = (a: Ticket, b: Ticket): number =>
  (parseInt(normalize(a.number), 10) || 0) - (parseInt(normalize(b.number), 10) || 0) ||
  a.createdAt - b.createdAt;

export const readLocal = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
export const writeLocal = (key: string, value: unknown): void => {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
};
