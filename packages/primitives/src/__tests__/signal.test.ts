import { describe, it, expect, vi } from 'vitest';
import { createSignal } from '../reactivity/signal';

describe('Signal primitive', () => {
  it('should store and retrieve a value', () => {
    const signal = createSignal(0);
    expect(signal.get()).toBe(0);
  });

  it('should update value with set', () => {
    const signal = createSignal(0);
    signal.set(5);
    expect(signal.get()).toBe(5);
  });

  it('should update value with updater function', () => {
    const signal = createSignal(10);
    signal.set(prev => prev + 5);
    expect(signal.get()).toBe(15);
  });

  it('should notify subscribers on change', () => {
    const signal = createSignal(0);
    const fn = vi.fn();
    signal.subscribe(fn);
    signal.set(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it('should not notify after unsubscribe', () => {
    const signal = createSignal(0);
    const fn = vi.fn();
    const unsub = signal.subscribe(fn);
    unsub();
    signal.set(1);
    expect(fn).not.toHaveBeenCalled();
  });

  it('should not notify when value is the same', () => {
    const signal = createSignal(1);
    const fn = vi.fn();
    signal.subscribe(fn);
    signal.set(1);
    expect(fn).not.toHaveBeenCalled();
  });

  it('should track reads via onRead callback', () => {
    const onRead = vi.fn();
    const signal = createSignal(0, { onRead });
    signal.get();
    expect(onRead).toHaveBeenCalledWith(signal);
  });

  it('peek should not trigger onRead', () => {
    const onRead = vi.fn();
    const signal = createSignal(0, { onRead });
    signal.peek();
    expect(onRead).not.toHaveBeenCalled();
  });

  // New: Error handling in subscribers
  it('should continue notifying other subscribers when one throws', () => {
    const signal = createSignal(0);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fn1 = vi.fn();
    const fn2 = vi.fn(() => { throw new Error('boom'); });
    const fn3 = vi.fn();

    signal.subscribe(fn1);
    signal.subscribe(fn2);
    signal.subscribe(fn3);
    signal.set(1);

    expect(fn1).toHaveBeenCalledWith(1);
    expect(fn3).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  // New: Re-entrance protection
  it('should handle re-entrant set calls safely', () => {
    const signal = createSignal(0);
    const values: number[] = [];

    signal.subscribe((v) => {
      values.push(v);
      if (v === 1) {
        signal.set(2); // re-entrant set during notification
      }
    });

    signal.set(1);
    // First notification: v=1 pushed, then re-entrant set(2) defers
    // After loop, dirty flag triggers re-notification with v=2
    expect(values).toEqual([1, 2]);
    expect(signal.get()).toBe(2);
  });

  it('should not infinite loop on convergent re-entrant updates', () => {
    const signal = createSignal(0);
    let callCount = 0;

    signal.subscribe((v) => {
      callCount++;
      if (v < 3) {
        signal.set(v + 1);
      }
    });

    signal.set(1);
    // 1 → subscriber sees 1, sets 2 (deferred) → re-notification with 2 → sets 3 (deferred) → re-notification with 3 → no more sets
    expect(signal.get()).toBe(3);
    expect(callCount).toBe(3);
  });

  // New: Non-convergent re-entrance is bounded by MAX_ITERATIONS
  it('should stop after MAX_ITERATIONS for non-convergent re-entrant updates', () => {
    const signal = createSignal(0);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    signal.subscribe((v) => {
      signal.set(v + 1); // always increments, never converges
    });

    signal.set(1);
    // Should stop at MAX_ITERATIONS (100) without infinite loop
    expect(signal.get()).toBeGreaterThan(50);
    expect(errorSpy).toHaveBeenCalledWith('Signal: maximum re-entrant notification iterations exceeded');
    errorSpy.mockRestore();
  });

  // New: onWrite callback
  it('should call onWrite callback when value changes', () => {
    const onWrite = vi.fn();
    const signal = createSignal(0, { onWrite });
    signal.set(1);
    expect(onWrite).toHaveBeenCalledWith(signal);
  });

  it('should not call onWrite when value is the same', () => {
    const onWrite = vi.fn();
    const signal = createSignal(1, { onWrite });
    signal.set(1);
    expect(onWrite).not.toHaveBeenCalled();
  });
});
