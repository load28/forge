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
});
