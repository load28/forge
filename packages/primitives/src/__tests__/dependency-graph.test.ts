import { describe, it, expect, vi } from 'vitest';
import { DependencyGraph } from '../reactivity/dependency-graph';
import { createSignal } from '../reactivity/signal';

describe('DependencyGraph', () => {
  it('should track signal reads and re-execute on change', () => {
    const graph = new DependencyGraph();
    const signal = createSignal(0, {
      onRead: (s) => graph.track(s),
    });

    const fn = vi.fn(() => {
      signal.get();
    });

    graph.autorun(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    signal.set(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should stop tracking after dispose', () => {
    const graph = new DependencyGraph();
    const signal = createSignal(0, {
      onRead: (s) => graph.track(s),
    });

    const fn = vi.fn(() => { signal.get(); });
    const disposable = graph.autorun(fn);

    disposable.dispose();
    signal.set(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should re-track dependencies on each run', () => {
    const graph = new DependencyGraph();
    const toggle = createSignal(true, { onRead: (s) => graph.track(s) });
    const a = createSignal('A', { onRead: (s) => graph.track(s) });
    const b = createSignal('B', { onRead: (s) => graph.track(s) });

    const results: string[] = [];
    graph.autorun(() => {
      results.push(toggle.get() ? a.get() : b.get());
    });

    expect(results).toEqual(['A']);

    a.set('A2');
    expect(results).toEqual(['A', 'A2']);

    toggle.set(false);
    expect(results).toEqual(['A', 'A2', 'B']);

    a.set('A3');
    expect(results).toEqual(['A', 'A2', 'B']);

    b.set('B2');
    expect(results).toEqual(['A', 'A2', 'B', 'B2']);
  });
});
