export const normalize = (n) => String(n ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const TONES = ['coral', 'cobalt', 'lime', 'tangerine', 'bubblegum'];
export const toneFor = (number) => {
  const n = parseInt(normalize(number) || '0', 10);
  return TONES[n % TONES.length];
};

export const fmtDate = (ts) =>
  ts ? new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
export const fmtTime = (ts) =>
  ts ? new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';

export const byNumber = (a, b) =>
  (parseInt(normalize(a.number), 10) || 0) - (parseInt(normalize(b.number), 10) || 0) ||
  a.createdAt - b.createdAt;

export const readLocal = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
export const writeLocal = (key, value) => {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
};
