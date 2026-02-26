import { describe, it, expect } from 'vitest';
import {
  ReactiveState,
  NodeKind,
  type ReactiveNode,
  reportRead,
  startTracking,
  endTracking,
  propagateDirty,
  updateIfNecessary,
  cleanupSources,
  snapshotSourceVersions,
  untracked,
} from '../reactivity/reactive-node';

function createSourceNode(version = 0): ReactiveNode {
  return {
    kind: NodeKind.SOURCE,
    state: ReactiveState.CLEAN,
    version,
    sources: [],
    sourcesVersions: [],
    observers: [],
  };
}

function createComputedNode(): ReactiveNode {
  return {
    kind: NodeKind.COMPUTED,
    state: ReactiveState.CLEAN,
    version: 0,
    sources: [],
    sourcesVersions: [],
    observers: [],
  };
}

function createEffectNode(notify?: () => void): ReactiveNode {
  return {
    kind: NodeKind.EFFECT,
    state: ReactiveState.CLEAN,
    version: 0,
    sources: [],
    sourcesVersions: [],
    observers: [],
    notify,
  };
}

describe('ReactiveNode - Tracking', () => {
  it('reportRead should add bidirectional edge', () => {
    const source = createSourceNode();
    const consumer = createComputedNode();

    startTracking(consumer);
    reportRead(source);
    endTracking(consumer);

    expect(consumer.sources).toContain(source);
    expect(source.observers).toContain(consumer);
  });

  it('reportRead should not add edge when not tracking', () => {
    const source = createSourceNode();
    reportRead(source);
    expect(source.observers).toHaveLength(0);
  });

  it('reportRead should not duplicate edges', () => {
    const source = createSourceNode();
    const consumer = createComputedNode();

    startTracking(consumer);
    reportRead(source);
    reportRead(source);
    endTracking(consumer);

    expect(consumer.sources).toHaveLength(1);
    expect(source.observers).toHaveLength(1);
  });

  it('nested tracking should work with stack', () => {
    const sourceA = createSourceNode();
    const sourceB = createSourceNode();
    const outer = createComputedNode();
    const inner = createComputedNode();

    startTracking(outer);
    reportRead(sourceA);

    startTracking(inner);
    reportRead(sourceB);
    endTracking(inner);

    endTracking(outer);

    expect(outer.sources).toEqual([sourceA]);
    expect(inner.sources).toEqual([sourceB]);
    expect(sourceA.observers).toEqual([outer]);
    expect(sourceB.observers).toEqual([inner]);
  });
});

describe('ReactiveNode - Push (propagateDirty)', () => {
  it('should mark direct dependents as DIRTY', () => {
    const source = createSourceNode();
    const computed = createComputedNode();
    source.observers.push(computed);

    propagateDirty(source);
    expect(computed.state).toBe(ReactiveState.DIRTY);
  });

  it('should mark indirect dependents as CHECK', () => {
    const source = createSourceNode();
    const computedA = createComputedNode();
    const computedB = createComputedNode();
    source.observers.push(computedA);
    computedA.observers.push(computedB);

    propagateDirty(source);
    expect(computedA.state).toBe(ReactiveState.DIRTY);
    expect(computedB.state).toBe(ReactiveState.CHECK);
  });

  it('should notify effect nodes', () => {
    let notified = false;
    const source = createSourceNode();
    const effect = createEffectNode(() => { notified = true; });
    source.observers.push(effect);

    propagateDirty(source);
    expect(notified).toBe(true);
    expect(effect.state).toBe(ReactiveState.DIRTY);
  });

  it('should notify indirect effect nodes', () => {
    let notified = false;
    const source = createSourceNode();
    const computed = createComputedNode();
    const effect = createEffectNode(() => { notified = true; });
    source.observers.push(computed);
    computed.observers.push(effect);

    propagateDirty(source);
    expect(computed.state).toBe(ReactiveState.DIRTY);
    expect(effect.state).toBe(ReactiveState.CHECK);
    expect(notified).toBe(true);
  });

  it('should not downgrade state (DIRTY -> CHECK is a no-op)', () => {
    const source = createSourceNode();
    const computed = createComputedNode();
    computed.state = ReactiveState.DIRTY;
    source.observers.push(computed);

    // propagateCheck would try to set CHECK, but DIRTY > CHECK, so no change
    propagateDirty(source);
    expect(computed.state).toBe(ReactiveState.DIRTY);
  });
});

describe('ReactiveNode - Pull (updateIfNecessary)', () => {
  it('CLEAN node should be a no-op', () => {
    const node = createComputedNode();
    node.state = ReactiveState.CLEAN;
    updateIfNecessary(node);
    expect(node.state).toBe(ReactiveState.CLEAN);
  });

  it('CHECK node with unchanged source should become CLEAN', () => {
    const source = createSourceNode(1);
    const computed = createComputedNode();
    computed.sources = [source];
    computed.sourcesVersions = [1]; // matches source.version
    computed.state = ReactiveState.CHECK;

    updateIfNecessary(computed);
    expect(computed.state).toBe(ReactiveState.CLEAN);
  });

  it('CHECK node with changed source should become DIRTY', () => {
    const source = createSourceNode(2);
    const computed = createComputedNode();
    computed.sources = [source];
    computed.sourcesVersions = [1]; // does NOT match source.version
    computed.state = ReactiveState.CHECK;

    updateIfNecessary(computed);
    expect(computed.state).toBe(ReactiveState.DIRTY);
  });

  it('DIRTY node should remain DIRTY (for caller to handle)', () => {
    const node = createComputedNode();
    node.state = ReactiveState.DIRTY;
    updateIfNecessary(node);
    expect(node.state).toBe(ReactiveState.DIRTY);
  });
});

describe('ReactiveNode - untracked', () => {
  it('should execute function without tracking', () => {
    const source = createSourceNode();
    const consumer = createComputedNode();

    startTracking(consumer);
    // Read inside untracked — should NOT create dependency
    untracked(() => {
      reportRead(source);
    });
    endTracking(consumer);

    expect(consumer.sources).toEqual([]);
    expect(source.observers).toEqual([]);
  });

  it('should return the function result', () => {
    const result = untracked(() => 42);
    expect(result).toBe(42);
  });

  it('should restore tracking context after execution', () => {
    const source1 = createSourceNode();
    const source2 = createSourceNode();
    const consumer = createComputedNode();

    startTracking(consumer);
    reportRead(source1); // tracked
    untracked(() => {
      reportRead(source2); // NOT tracked
    });
    endTracking(consumer);

    expect(consumer.sources).toEqual([source1]);
    expect(source1.observers).toEqual([consumer]);
    expect(source2.observers).toEqual([]);
  });
});

describe('ReactiveNode - Pull (iterative updateIfNecessary)', () => {
  it('should handle deep computed chain without stack overflow', () => {
    // Build a chain of 500 computed nodes: source → c0 → c1 → ... → c499
    const source = createSourceNode(1);
    let prev: ReactiveNode = source;

    const chain: ReactiveNode[] = [];
    for (let i = 0; i < 500; i++) {
      const node = createComputedNode();
      node.sources = [prev];
      node.sourcesVersions = [prev.version];
      node.state = ReactiveState.CHECK;
      prev.observers.push(node);
      // Give it a compute that marks it clean
      node.compute = () => {
        node.version++;
        node.state = ReactiveState.CLEAN;
      };
      chain.push(node);
      prev = node;
    }

    // The last node in the chain should be updateable without stack overflow
    const last = chain[chain.length - 1];
    last.state = ReactiveState.CHECK;
    updateIfNecessary(last);
    // Should complete without throwing
    expect(last.state).toBe(ReactiveState.CLEAN);
  });
});

describe('ReactiveNode - Cleanup', () => {
  it('cleanupSources should remove bidirectional edges', () => {
    const source = createSourceNode();
    const consumer = createComputedNode();
    consumer.sources = [source];
    source.observers = [consumer];

    cleanupSources(consumer);

    expect(consumer.sources).toEqual([]);
    expect(source.observers).toEqual([]);
  });

  it('snapshotSourceVersions should capture current versions', () => {
    const s1 = createSourceNode(3);
    const s2 = createSourceNode(7);
    const node = createComputedNode();
    node.sources = [s1, s2];

    snapshotSourceVersions(node);
    expect(node.sourcesVersions).toEqual([3, 7]);
  });
});
