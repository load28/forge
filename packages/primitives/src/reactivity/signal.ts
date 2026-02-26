export interface Signal<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(fn: (value: T) => void): () => void;
  peek(): T;
}

export interface SignalOptions<T> {
  onRead?: (signal: Signal<T>) => void;
  equals?: (a: T, b: T) => boolean;
}

export function createSignal<T>(initial: T, options?: SignalOptions<T>): Signal<T> {
  let value = initial;
  const subscribers = new Set<(value: T) => void>();
  const equals = options?.equals ?? Object.is;

  const signal: Signal<T> = {
    get() {
      options?.onRead?.(signal);
      return value;
    },
    peek() {
      return value;
    },
    set(next) {
      const newValue = typeof next === 'function'
        ? (next as (prev: T) => T)(value)
        : next;
      if (equals(value, newValue)) return;
      value = newValue;
      for (const fn of [...subscribers]) fn(value);
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => { subscribers.delete(fn); };
    },
  };

  return signal;
}
