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
});
