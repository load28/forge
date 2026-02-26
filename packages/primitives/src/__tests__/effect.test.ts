import { describe, it, expect, vi } from 'vitest';
import { createEffect } from '../reactivity/effect';
import { createComputed } from '../reactivity/computed';
import { createSignal } from '../reactivity/signal';
import {
  type ReactiveNode,
  ReactiveState,
  NodeKind,
  reportRead,
  propagateDirty,
} from '../reactivity/reactive-node';

// Helper: create a signal that participates in the reactive graph
function graphSignal<T>(initial: T) {
  const node: ReactiveNode = {
    kind: NodeKind.SOURCE,
    state: ReactiveState.CLEAN,
    version: 0,
    sources: [],
    sourcesVersions: [],
    observers: [],
  };

  const signal = createSignal(initial, {
    onRead: () => reportRead(node),
    onWrite: () => {
      node.version++;
      propagateDirty(node);
    },
  });

  return { signal, node };
}

describe('Effect', () => {
  it('should run immediately on creation', () => {
    const fn = vi.fn();
    createEffect(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should re-run when source signal changes', () => {
    const { signal: count } = graphSignal(0);
    const values: number[] = [];

    createEffect(() => {
      values.push(count.get());
    });

    expect(values).toEqual([0]);
    count.set(1);
    expect(values).toEqual([0, 1]);
    count.set(2);
    expect(values).toEqual([0, 1, 2]);
  });

  it('should not re-run when source set to same value', () => {
    const { signal: count } = graphSignal(5);
    const fn = vi.fn(() => { count.get(); });

    createEffect(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    count.set(5); // same value
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should stop re-executing after dispose', () => {
    const { signal: count } = graphSignal(0);
    const fn = vi.fn(() => { count.get(); });

    const handle = createEffect(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    handle.dispose();
    count.set(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should call cleanup function before re-run', () => {
    const { signal: count } = graphSignal(0);
    const cleanupFn = vi.fn();

    createEffect(() => {
      count.get();
      return cleanupFn;
    });

    expect(cleanupFn).not.toHaveBeenCalled();

    count.set(1);
    expect(cleanupFn).toHaveBeenCalledTimes(1);

    count.set(2);
    expect(cleanupFn).toHaveBeenCalledTimes(2);
  });

  it('should call cleanup function on dispose', () => {
    const { signal: count } = graphSignal(0);
    const cleanupFn = vi.fn();

    const handle = createEffect(() => {
      count.get();
      return cleanupFn;
    });

    expect(cleanupFn).not.toHaveBeenCalled();

    handle.dispose();
    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });

  it('should work with computed dependencies', () => {
    const { signal: count } = graphSignal(1);
    const doubled = createComputed(() => count.get() * 2);
    const values: number[] = [];

    createEffect(() => {
      values.push(doubled.get());
    });

    expect(values).toEqual([2]);
    count.set(3);
    expect(values).toEqual([2, 6]);
  });

  it('should handle diamond dependency with deferred scheduler — run once', () => {
    // With default sync scheduler, the effect runs during propagation before
    // all branches are marked dirty. Glitch-free diamond requires a deferred
    // scheduler (as the strategy layer provides via batch wrapping).
    const { signal: source } = graphSignal(1);
    const left = createComputed(() => source.get() + 1);
    const right = createComputed(() => source.get() * 2);
    const pending: (() => void)[] = [];
    const fn = vi.fn(() => {
      left.get();
      right.get();
    });

    createEffect(fn, (run) => { pending.push(run); });
    expect(fn).toHaveBeenCalledTimes(1); // immediate first execution

    source.set(2);
    // Effect was scheduled but not yet run
    expect(fn).toHaveBeenCalledTimes(1);
    expect(pending).toHaveLength(1);

    // Now flush — both left and right are already DIRTY
    pending[0]();
    expect(fn).toHaveBeenCalledTimes(2); // only once for the change
  });

  it('should support custom scheduler', () => {
    const { signal: count } = graphSignal(0);
    const scheduled: (() => void)[] = [];

    createEffect(
      () => { count.get(); },
      (run) => { scheduled.push(run); },
    );

    count.set(1);
    expect(scheduled).toHaveLength(1);

    // Execute the scheduled effect
    scheduled[0]();
    count.set(2);
    expect(scheduled).toHaveLength(2);
  });

  it('should re-track dynamic dependencies', () => {
    const { signal: toggle } = graphSignal(true);
    const { signal: a } = graphSignal('A');
    const { signal: b } = graphSignal('B');
    const values: string[] = [];

    createEffect(() => {
      values.push(toggle.get() ? a.get() : b.get());
    });

    expect(values).toEqual(['A']);

    a.set('A2');
    expect(values).toEqual(['A', 'A2']);

    toggle.set(false);
    expect(values).toEqual(['A', 'A2', 'B']);

    // Changing 'a' should not trigger (no longer a dependency)
    a.set('A3');
    expect(values).toEqual(['A', 'A2', 'B']);

    b.set('B2');
    expect(values).toEqual(['A', 'A2', 'B', 'B2']);
  });

  it('should guard against re-entrant execution (TC-4)', () => {
    // An effect that writes to its own source should not infinite loop
    const { signal: count } = graphSignal(0);
    const values: number[] = [];

    createEffect(() => {
      const v = count.get();
      values.push(v);
      // Write during execution — this triggers propagateDirty + notify,
      // but the re-entrance guard prevents recursive execute()
      if (v < 2) {
        count.set(v + 1);
      }
    });

    // Should converge, not infinite loop
    expect(values.length).toBeGreaterThanOrEqual(1);
    expect(values.length).toBeLessThan(100);
  });

  it('should support nested effects without corrupting tracking', () => {
    const { signal: outer } = graphSignal('outer');
    const { signal: inner } = graphSignal('inner');
    const outerValues: string[] = [];
    const innerValues: string[] = [];

    createEffect(() => {
      outerValues.push(outer.get());
      const innerHandle = createEffect(() => {
        innerValues.push(inner.get());
      });
      return () => innerHandle.dispose();
    });

    expect(outerValues).toEqual(['outer']);
    expect(innerValues).toEqual(['inner']);

    inner.set('inner2');
    expect(innerValues).toEqual(['inner', 'inner2']);
    expect(outerValues).toEqual(['outer']); // unchanged

    outer.set('outer2');
    expect(outerValues).toEqual(['outer', 'outer2']);
  });
});
