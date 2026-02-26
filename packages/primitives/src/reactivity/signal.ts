export interface Signal<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(fn: (value: T) => void): () => void;
  peek(): T;
}

/** Read-only view of a signal — omits set() for consumers that should not write (DX-4). */
export interface ReadonlySignal<T> {
  get(): T;
  subscribe(fn: (value: T) => void): () => void;
  peek(): T;
}

export interface SignalOptions<T> {
  onRead?: (signal: Signal<T>) => void;
  onWrite?: (signal: Signal<T>) => void;
  equals?: (a: T, b: T) => boolean;
}

export function createSignal<T>(initial: T, options?: SignalOptions<T>): Signal<T> {
  let value = initial;
  const subscribers = new Set<(value: T) => void>();
  const equals = options?.equals ?? Object.is;
  let notifying = false;
  let dirty = false;

  function notify(): void {
    notifying = true;
    let iterations = 0;
    const MAX_ITERATIONS = 100;
    try {
      do {
        dirty = false;
        if (++iterations > MAX_ITERATIONS) {
          console.error('Signal: maximum re-entrant notification iterations exceeded');
          break;
        }
        for (const fn of [...subscribers]) {
          // Liveness check: skip subscribers removed during this notification cycle (TC-3)
          if (!subscribers.has(fn)) continue;
          try {
            fn(value);
          } catch (e) {
            console.error('Error in signal subscriber:', e);
          }
        }
      } while (dirty);
    } finally {
      notifying = false;
      dirty = false;
    }
  }

  const signal: Signal<T> = {
    get() {
      options?.onRead?.(signal);
      return value;
    },
    peek() {
      return value;
    },
    // BUG-13 note: When T is a function type, passing a function to set()
    // is ambiguous — it's treated as an updater `(prev) => next` rather than
    // a raw value. Callers must use the updater form: `set(() => myFunction)`.
    // This matches React's useState convention for function-typed state.
    set(next) {
      const newValue = typeof next === 'function'
        ? (next as (prev: T) => T)(value)
        : next;
      if (equals(value, newValue)) return;
      value = newValue;
      // onWrite fires first (graph propagation), then subscribe callbacks.
      // Graph consumers (effects/computed) are notified via onWrite → propagateDirty.
      // Direct subscribers are a separate, lower-level notification path.
      options?.onWrite?.(signal);
      if (notifying) {
        dirty = true;
        return;
      }
      notify();
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => { subscribers.delete(fn); };
    },
  };

  return signal;
}
