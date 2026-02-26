export interface HashListener {
  getPath(): string;
  setPath(path: string): void;
  onChange(callback: (path: string) => void): () => void;
  destroy(): void;
}

/**
 * A-1: Window abstraction for testability and SSR compatibility.
 * Allows injecting a mock window for unit tests without jsdom.
 */
export interface WindowLike {
  location: { hash: string };
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

/**
 * S6: Basic path sanitization — strip control characters and normalize.
 * Prevents path traversal and injection via malformed hash fragments.
 */
function sanitizePath(raw: string): string {
  // Strip control characters (U+0000–U+001F, U+007F)
  const cleaned = raw.replace(/[\x00-\x1f\x7f]/g, '');
  // Ensure path starts with /
  return cleaned.startsWith('/') ? cleaned : '/' + cleaned;
}

/**
 * Create a hash-based path listener.
 * @param win - Optional window-like object for testability (A-1).
 *   Defaults to `window` in browser environments.
 */
export function createHashListener(win?: WindowLike): HashListener {
  const w: WindowLike = win ?? window;
  const callbacks = new Set<(path: string) => void>();

  function getPath(): string {
    const hash = w.location.hash.slice(1);
    // TC-3: Handle hash-within-hash — only use the first fragment.
    const secondHash = hash.indexOf('#');
    const cleanHash = secondHash >= 0 ? hash.slice(0, secondHash) : hash;
    return sanitizePath(cleanHash || '/');
  }

  function handler() {
    const path = getPath();
    // BUG-16 fix: Snapshot callbacks before iteration
    const snapshot = [...callbacks];
    for (const cb of snapshot) cb(path);
  }

  w.addEventListener('hashchange', handler);

  return {
    getPath,
    setPath(path: string) {
      w.location.hash = '#' + sanitizePath(path);
    },
    onChange(callback) {
      callbacks.add(callback);
      return () => { callbacks.delete(callback); };
    },
    destroy() {
      w.removeEventListener('hashchange', handler);
      callbacks.clear();
    },
  };
}
