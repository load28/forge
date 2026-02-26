import type { ReactiveSystem, Disposable, Cleanup } from '@forge/core';
import { createSignal, BatchQueue, type Signal } from '@forge/primitives';

export interface SignalReactiveSystem extends ReactiveSystem {
  signal<T>(initial: T): Signal<T>;
}

export function signalReactive(): SignalReactiveSystem {
  const batchQueue = new BatchQueue();
  let currentDeps: Set<Signal<any>> | null = null;

  function track(signal: Signal<any>): void {
    if (currentDeps) {
      currentDeps.add(signal);
    }
  }

  function signal<T>(initial: T): Signal<T> {
    return createSignal(initial, {
      onRead: (s) => track(s),
    });
  }

  function autorun(fn: () => void | Cleanup): Disposable {
    let disposed = false;
    let cleanup: Cleanup | undefined;
    let unsubs: (() => void)[] = [];
    let scheduled = false;

    const run = () => {
      if (disposed) return;
      scheduled = false;

      // cleanup previous
      cleanup?.();
      unsubs.forEach(u => u());
      unsubs = [];

      // track new deps
      const deps = new Set<Signal<any>>();
      currentDeps = deps;
      try {
        const result = fn();
        if (typeof result === 'function') {
          cleanup = result;
        }
      } finally {
        currentDeps = null;
      }

      // subscribe to tracked deps, routing through batchQueue for dedup
      for (const dep of deps) {
        const unsub = dep.subscribe(() => {
          if (!scheduled) {
            scheduled = true;
            batchQueue.enqueue(run);
          }
        });
        unsubs.push(unsub);
      }
    };

    run();

    return {
      dispose() {
        disposed = true;
        cleanup?.();
        unsubs.forEach(u => u());
        unsubs = [];
      },
    };
  }

  function batch(fn: () => void): void {
    batchQueue.batch(fn);
  }

  return { signal, autorun, batch };
}
