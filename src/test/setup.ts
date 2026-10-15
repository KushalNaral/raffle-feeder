import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';

// Most tests run in jsdom; the real-OCR tests run in plain Node and skip the DOM setup.
if (typeof window !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
  const { cleanup } = await import('@testing-library/react');

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  // jsdom leaves these out; the app only needs them to exist.
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;

  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // No canvas in jsdom: report "unsupported" instead of logging a not-implemented error.
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
  URL.createObjectURL ??= () => 'blob:test';
  URL.revokeObjectURL ??= () => {};

  // jsdom's Blob predates Blob#text(); every browser the app targets has it.
  Blob.prototype.text ??= function text(this: Blob) {
    return new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsText(this);
    });
  };
  Element.prototype.scrollIntoView ??= () => {};
}
