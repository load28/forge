import { describe, it, expect, vi } from 'vitest';
import { createGraphSignal } from '../reactivity/graph-signal';
import { createComputed } from '../reactivity/computed';
import { createEffect } from '../reactivity/effect';
import { ReactiveState, NodeKind } from '../reactivity/reactive-node';

describe('createGraphSignal (AR-1)', () => {
  it('should create a signal wired to a reactive node', () => {
    const gs = createGraphSignal(42);
    expect(gs.get()).toBe(42);
    expect(gs.node).toBeDefined();
    expect(gs.node.kind).toBe(NodeKind.SOURCE);
    expect(gs.node.state).toBe(ReactiveState.CLEAN);
  });

  it('should increment node version on set', () => {
    const gs = createGraphSignal(0);
    expect(gs.node.version).toBe(0);
    gs.set(1);
    expect(gs.node.version).toBe(1);
    gs.set(2);
    expect(gs.node.version).toBe(2);
  });

  it('should not increment version when value unchanged', () => {
    const gs = createGraphSignal(5);
    gs.set(5); // same value
    expect(gs.node.version).toBe(0);
  });

  it('should work with computed', () => {
    const count = createGraphSignal(1);
    const doubled = createComputed(() => count.get() * 2);

    expect(doubled.get()).toBe(2);
    count.set(5);
    expect(doubled.get()).toBe(10);
  });

  it('should work with effect', () => {
    const count = createGraphSignal(0);
    const values: number[] = [];

    createEffect(() => {
      values.push(count.get());
    });

    expect(values).toEqual([0]);
    count.set(1);
    expect(values).toEqual([0, 1]);
  });

  it('should support custom equals', () => {
    const gs = createGraphSignal(
      { x: 1 },
      { equals: (a, b) => a.x === b.x },
    );

    gs.set({ x: 1 }); // same by custom equals
    expect(gs.node.version).toBe(0);

    gs.set({ x: 2 }); // different
    expect(gs.node.version).toBe(1);
  });

  it('should handle diamond dependency (computed chain)', () => {
    const source = createGraphSignal(1);
    const left = createComputed(() => source.get() + 1);
    const right = createComputed(() => source.get() * 2);
    const combined = createComputed(() => left.get() + right.get());

    expect(combined.get()).toBe(4); // (1+1) + (1*2) = 4
    source.set(3);
    expect(combined.get()).toBe(10); // (3+1) + (3*2) = 10
  });
});
