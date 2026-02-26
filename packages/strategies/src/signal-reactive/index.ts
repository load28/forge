import type { ReactiveSystem, Disposable, Cleanup } from '@forge/core';
import {
  BatchQueue,
  type Signal,
  createComputed,
  type Computed,
  createEffect,
  createGraphSignal,
  propagateDirty,
} from '@forge/primitives';

export interface SignalReactiveSystem extends ReactiveSystem {
  signal<T>(initial: T): Signal<T>;
  computed<T>(fn: () => T, options?: { equals?: (a: T, b: T) => boolean }): Computed<T>;
}

export function signalReactive(): SignalReactiveSystem {
  const batchQueue = new BatchQueue();
  const pendingEffects = new Set<() => void>();
  let flushing = false;

  const flush = () => {
    if (flushing) return;
    flushing = true;
    let iterations = 0;
    const MAX_ITERATIONS = 100;
    try {
      while (pendingEffects.size > 0) {
        if (++iterations > MAX_ITERATIONS) {
          console.error('SignalReactive: maximum flush iterations exceeded');
          pendingEffects.clear();
          break;
        }
        const effects = [...pendingEffects];
        pendingEffects.clear();
        for (const run of effects) {
          run();
        }
      }
    } finally {
      flushing = false;
    }
  };

  function scheduleEffect(run: () => void): void {
    pendingEffects.add(run);
    batchQueue.enqueue(flush);
  }

  /**
   * AR-1: Use createGraphSignal for automatic graph wiring.
   * Wraps onWrite in batch so all dirty flags propagate before effects flush,
   * preventing diamond glitch.
   */
  function signal<T>(initial: T): Signal<T> {
    const gs = createGraphSignal(initial);

    // Override onWrite behavior: wrap propagation in batch for glitch-free updates
    const originalSet = gs.set.bind(gs);
    const batchedSignal: Signal<T> = {
      get: gs.get.bind(gs),
      peek: gs.peek.bind(gs),
      subscribe: gs.subscribe.bind(gs),
      set(next: T | ((prev: T) => T)) {
        // The graph signal's onWrite already calls propagateDirty.
        // We need batch wrapping around the entire set operation.
        batchQueue.batch(() => {
          originalSet(next);
        });
      },
    };
    return batchedSignal;
  }

  // Computed nodes don't need batch wrapping — they only update their own version
  // during recomputation (pull phase). The push phase is always initiated from SOURCE nodes.
  function computed<T>(fn: () => T, options?: { equals?: (a: T, b: T) => boolean }): Computed<T> {
    return createComputed(fn, options);
  }

  function autorun(fn: () => void | Cleanup): Disposable {
    const handle = createEffect(fn, scheduleEffect);
    return { dispose: () => handle.dispose() };
  }

  function batch(fn: () => void): void {
    batchQueue.batch(fn);
  }

  return { signal, computed, autorun, batch };
}
