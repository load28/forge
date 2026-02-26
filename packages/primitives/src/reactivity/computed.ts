import {
  type ReactiveNode,
  ReactiveState,
  NodeKind,
  reportRead,
  startTracking,
  endTracking,
  updateIfNecessary,
  cleanupSources,
  snapshotSourceVersions,
  incrementVersion,
} from './reactive-node';

export interface Computed<T> {
  get(): T;
  peek(): T;
}

export interface ComputedOptions<T> {
  equals?: (a: T, b: T) => boolean;
}

export function createComputed<T>(fn: () => T, options?: ComputedOptions<T>): Computed<T> {
  let value: T = undefined as T;
  let initialized = false;
  const equals = options?.equals ?? Object.is;

  const node: ReactiveNode = {
    kind: NodeKind.COMPUTED,
    state: ReactiveState.DIRTY, // Initially dirty — needs first computation
    version: 0,
    sources: [],
    sourcesVersions: [],
    observers: [],
    _computing: false,
    compute: undefined, // Set below after recompute is defined
  };

  function recompute(): void {
    if (node._computing) {
      throw new Error('Circular dependency detected in computed');
    }

    cleanupSources(node);

    node._computing = true;
    startTracking(node);
    try {
      const newValue = fn();
      if (!initialized || !equals(value, newValue)) {
        value = newValue;
        incrementVersion(node);
        initialized = true;
      }
    } finally {
      endTracking(node);
      node._computing = false;
    }

    snapshotSourceVersions(node);
    node.state = ReactiveState.CLEAN;
  }

  // Register the recompute function on the node for updateIfNecessary to call
  node.compute = recompute;

  const computed: Computed<T> = {
    get() {
      reportRead(node);
      // Pull: updateIfNecessary handles DIRTY→recompute for COMPUTED nodes
      updateIfNecessary(node);
      return value;
    },
    peek() {
      updateIfNecessary(node);
      return value;
    },
  };

  return computed;
}
