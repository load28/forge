import type { Disposable, Cleanup } from '../types';

/**
 * ReactiveSystem protocol — fine-grained reactivity engine.
 *
 * Implementations must provide:
 * - `autorun`: Automatically re-execute a function when its reactive dependencies change.
 * - `batch`: Group multiple signal writes into a single notification flush.
 * - `computed` (optional): Create lazy memoized derived values.
 *
 * Reference implementations: SolidJS createEffect, Preact Signals effect.
 * See: https://docs.solidjs.com/concepts/intro-to-reactivity
 * See: https://preactjs.com/guide/v10/signals/
 */
export interface ReactiveSystem {
  /** Track reactive reads inside `fn` and re-execute when dependencies change. */
  autorun(fn: () => void | Cleanup): Disposable;

  /**
   * Batch multiple signal writes — downstream computations are deferred
   * until the batch completes, preventing intermediate re-renders.
   * See: https://docs.solidjs.com/references/api-reference/reactive-utilities/batch
   */
  batch(fn: () => void): void;

  /** Create a lazy memoized derived value (optional for backward compat). */
  computed?<T>(fn: () => T, options?: { equals?: (a: T, b: T) => boolean }): { get(): T; peek(): T };
}
