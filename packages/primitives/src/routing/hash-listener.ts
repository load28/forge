export interface HashListener {
  getPath(): string;
  setPath(path: string): void;
  onChange(callback: (path: string) => void): () => void;
  destroy(): void;
}

export function createHashListener(): HashListener {
  const callbacks = new Set<(path: string) => void>();

  function getPath(): string {
    const hash = window.location.hash.slice(1);
    return hash || '/';
  }

  function handler() {
    const path = getPath();
    for (const cb of callbacks) cb(path);
  }

  window.addEventListener('hashchange', handler);

  return {
    getPath,
    setPath(path: string) {
      window.location.hash = '#' + path;
    },
    onChange(callback) {
      callbacks.add(callback);
      return () => { callbacks.delete(callback); };
    },
    destroy() {
      window.removeEventListener('hashchange', handler);
      callbacks.clear();
    },
  };
}
