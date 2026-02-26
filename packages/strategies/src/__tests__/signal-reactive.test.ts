import { describe, it, expect, vi } from 'vitest';
import { signalReactive } from '../signal-reactive/index';
import type { ReactiveSystem } from '@forge/core';

describe('signalReactive strategy', () => {
  it('should implement ReactiveSystem protocol', () => {
    const reactive = signalReactive();
    expect(reactive.autorun).toBeTypeOf('function');
    expect(reactive.batch).toBeTypeOf('function');
  });

  it('autorun should track signal reads and re-execute', () => {
    const reactive = signalReactive();
    const count = reactive.signal(0);
    const values: number[] = [];

    reactive.autorun(() => {
      values.push(count.get());
    });

    expect(values).toEqual([0]);
    count.set(1);
    expect(values).toEqual([0, 1]);
    count.set(2);
    expect(values).toEqual([0, 1, 2]);
  });

  it('autorun dispose should stop tracking', () => {
    const reactive = signalReactive();
    const count = reactive.signal(0);
    const fn = vi.fn(() => { count.get(); });

    const disposable = reactive.autorun(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    disposable.dispose();
    count.set(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should expose signal() as strategy-specific API', () => {
    const reactive = signalReactive();
    const sig = reactive.signal(42);
    expect(sig.get()).toBe(42);
    sig.set(100);
    expect(sig.get()).toBe(100);
  });

  it('batch should defer autorun until batch ends', () => {
    const reactive = signalReactive();
    const a = reactive.signal(0);
    const b = reactive.signal(0);
    const fn = vi.fn(() => { a.get(); b.get(); });

    reactive.autorun(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    reactive.batch(() => {
      a.set(1);
      b.set(1);
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  // New: Nested autorun with push-pull graph
  it('should support nested autoruns with correct dependency tracking', () => {
    const reactive = signalReactive();
    const outer = reactive.signal('outer');
    const inner = reactive.signal('inner');

    const outerValues: string[] = [];
    const innerValues: string[] = [];

    reactive.autorun(() => {
      outerValues.push(outer.get());

      const d = reactive.autorun(() => {
        innerValues.push(inner.get());
      });
      return () => d.dispose();
    });

    expect(outerValues).toEqual(['outer']);
    expect(innerValues).toEqual(['inner']);

    // Changing inner should only re-run inner effect
    inner.set('inner2');
    expect(innerValues).toEqual(['inner', 'inner2']);
    expect(outerValues).toEqual(['outer']);
  });

  // New: Nested batch support
  it('should support nested batches', () => {
    const reactive = signalReactive();
    const a = reactive.signal(0);
    const b = reactive.signal(0);
    const c = reactive.signal(0);
    const fn = vi.fn(() => { a.get(); b.get(); c.get(); });

    reactive.autorun(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    reactive.batch(() => {
      a.set(1);
      reactive.batch(() => {
        b.set(1);
        c.set(1);
      });
      // Inner batch ended but outer still active — autorun should NOT have run yet
      expect(fn).toHaveBeenCalledTimes(1);
    });

    // Now all updates flushed
    expect(fn).toHaveBeenCalledTimes(2);
  });

  // New: Computed values
  it('computed should return derived value', () => {
    const reactive = signalReactive();
    const count = reactive.signal(5);
    const doubled = reactive.computed(() => count.get() * 2);
    expect(doubled.get()).toBe(10);
  });

  it('computed should update when source changes', () => {
    const reactive = signalReactive();
    const count = reactive.signal(1);
    const doubled = reactive.computed(() => count.get() * 2);
    expect(doubled.get()).toBe(2);
    count.set(5);
    expect(doubled.get()).toBe(10);
  });

  it('autorun should work with computed values', () => {
    const reactive = signalReactive();
    const a = reactive.signal(1);
    const b = reactive.computed(() => a.get() * 2);
    const values: number[] = [];
    reactive.autorun(() => { values.push(b.get()); });
    expect(values).toEqual([2]);
    a.set(3);
    expect(values).toEqual([2, 6]);
  });

  // New: Diamond dependency — glitch-free
  it('diamond dependency should not cause glitch', () => {
    const reactive = signalReactive();
    const source = reactive.signal(1);
    const left = reactive.computed(() => source.get() + 1);
    const right = reactive.computed(() => source.get() * 2);
    const values: [number, number][] = [];
    reactive.autorun(() => {
      values.push([left.get(), right.get()]);
    });
    expect(values).toEqual([[2, 2]]);
    source.set(2);
    // Should see [3, 4] — never an intermediate glitch like [3, 2] or [2, 4]
    expect(values).toEqual([[2, 2], [3, 4]]);
  });

  it('batch with computed should defer until batch ends', () => {
    const reactive = signalReactive();
    const a = reactive.signal(0);
    const b = reactive.signal(0);
    const sum = reactive.computed(() => a.get() + b.get());
    const values: number[] = [];
    reactive.autorun(() => { values.push(sum.get()); });
    expect(values).toEqual([0]);
    reactive.batch(() => {
      a.set(1);
      b.set(2);
    });
    expect(values).toEqual([0, 3]);
  });

  // Effect writes to another signal — cascade test (I6)
  it('effect writing to another signal should trigger dependent effects', () => {
    const reactive = signalReactive();
    const source = reactive.signal(0);
    const derived = reactive.signal(0);
    const derivedValues: number[] = [];

    // Effect 1: writes to derived whenever source changes
    reactive.autorun(() => {
      derived.set(source.get() * 10);
    });

    // Effect 2: reads derived
    reactive.autorun(() => {
      derivedValues.push(derived.get());
    });

    expect(derivedValues).toEqual([0]);
    source.set(1);
    expect(derivedValues).toEqual([0, 10]);
    source.set(2);
    expect(derivedValues).toEqual([0, 10, 20]);
  });

  // Deep chain test (5 levels)
  it('should handle deep computed chains', () => {
    const reactive = signalReactive();
    const source = reactive.signal(1);
    const c1 = reactive.computed(() => source.get() + 1);
    const c2 = reactive.computed(() => c1.get() + 1);
    const c3 = reactive.computed(() => c2.get() + 1);
    const c4 = reactive.computed(() => c3.get() + 1);
    const c5 = reactive.computed(() => c4.get() + 1);

    expect(c5.get()).toBe(6); // 1+1+1+1+1+1
    source.set(10);
    expect(c5.get()).toBe(15); // 10+1+1+1+1+1
  });

  // Batch should not expose intermediate computed states
  it('batch should not expose intermediate computed states', () => {
    const reactive = signalReactive();
    const a = reactive.signal(1);
    const b = reactive.signal(1);
    const sum = reactive.computed(() => a.get() + b.get());
    const values: number[] = [];

    reactive.autorun(() => { values.push(sum.get()); });
    expect(values).toEqual([2]);

    reactive.batch(() => {
      a.set(10);
      // sum would be 11 here if eagerly computed, but batch defers
      b.set(20);
    });
    // Should only see final value, not intermediate 11
    expect(values).toEqual([2, 30]);
  });
});
