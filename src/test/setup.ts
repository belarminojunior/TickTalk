import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Node 25+ has its own (experimental) localStorage/sessionStorage globals, undefined unless
// Node is started with --localstorage-file; they hide jsdom's. Put jsdom's back.
const dom = (globalThis as { jsdom?: { window: Window } }).jsdom;
for (const key of ['localStorage', 'sessionStorage'] as const) {
  if (dom && !globalThis[key]) {
    Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true, writable: true });
  }
}

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    /* ignore */
  }
});
