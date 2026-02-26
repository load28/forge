// Push-Pull Reactive Graph Core
// Based on the algorithm used by Preact Signals, SolidJS, and TC39 Signal proposal.
// See: https://github.com/tc39/proposal-signals
// See: https://preactjs.com/blog/signal-boosting/

// Using plain enum (not const enum) for compatibility with isolatedModules / esbuild
export enum ReactiveState {
  CLEAN = 0,   // Value is current
  CHECK = 1,   // Indirect dependency may have changed — verify before trusting
  DIRTY = 2,   // Direct dependency changed — must recompute
}

export enum NodeKind {
  SOURCE = 0,
  COMPUTED = 1,
  EFFECT = 2,
}

export interface ReactiveNode {
  kind: NodeKind;
  state: ReactiveState;
  version: number;
  sources: ReactiveNode[];
  sourcesVersions: number[];
  observers: ReactiveNode[];
  /** Auxiliary Sets for O(1) existence checks in reportRead/cleanupSources */
  _sourcesSet?: Set<ReactiveNode>;
  _observersSet?: Set<ReactiveNode>;
  // Only for COMPUTED nodes — triggers lazy recomputation
  _computing?: boolean;
  compute?: () => void;
  // Only for EFFECT nodes — called when effect needs scheduling
  notify?: () => void;
}

// ---- Dependency Tracking Context ----

let currentConsumer: ReactiveNode | null = null;
const trackingStack: (ReactiveNode | null)[] = [];

export function startTracking(consumer: ReactiveNode): void {
  trackingStack.push(currentConsumer);
  currentConsumer = consumer;
}

export function endTracking(consumer: ReactiveNode): void {
  if (currentConsumer !== consumer) {
    console.warn('Forge: endTracking called with mismatched consumer');
  }
  currentConsumer = trackingStack.pop() ?? null;
}

export function isTracking(): boolean {
  return currentConsumer !== null;
}

/**
 * Execute a function without tracking any signal reads.
 * Useful for reading signals inside effects/computed without creating dependencies.
 * Based on SolidJS's untrack() and TC39 Signal proposal's untrack concept.
 * See: https://github.com/tc39/proposal-signals
 */
export function untracked<T>(fn: () => T): T {
  const prev = currentConsumer;
  currentConsumer = null;
  try {
    return fn();
  } finally {
    currentConsumer = prev;
  }
}

/** Called by signal.get() / computed.get() to register a read dependency */
export function reportRead(source: ReactiveNode): void {
  if (currentConsumer === null) return;
  // O(1) existence check via auxiliary Set
  const sourcesSet = currentConsumer._sourcesSet ??= new Set();
  if (!sourcesSet.has(source)) {
    sourcesSet.add(source);
    currentConsumer.sources.push(source);
    const observersSet = source._observersSet ??= new Set();
    observersSet.add(currentConsumer);
    source.observers.push(currentConsumer);
  }
}

// ---- Push Phase: Dirty Propagation (Iterative) ----
// Converted from recursive to iterative BFS to prevent stack overflow on deep
// reactive graphs (S5). Preact Signals uses linked-list traversal; TC39 proposal
// uses recursive consumerMarkDirty. Our BFS approach avoids V8's ~10,400 frame
// limit while maintaining the same DIRTY/CHECK semantics.

export function propagateDirty(source: ReactiveNode): void {
  // Phase 1: Mark direct observers as DIRTY
  const queue: ReactiveNode[] = [];

  for (let i = 0, len = source.observers.length; i < len; i++) {
    const observer = source.observers[i];
    if (observer.state < ReactiveState.DIRTY) {
      observer.state = ReactiveState.DIRTY;
      if (observer.kind === NodeKind.EFFECT && observer.notify) {
        observer.notify();
      }
      queue.push(observer);
    }
  }

  // Phase 2: Mark all downstream observers as CHECK (BFS)
  // Using index-based iteration avoids .shift() overhead
  let head = 0;
  while (head < queue.length) {
    const node = queue[head++];
    for (let i = 0, len = node.observers.length; i < len; i++) {
      const observer = node.observers[i];
      if (observer.state < ReactiveState.CHECK) {
        observer.state = ReactiveState.CHECK;
        if (observer.kind === NodeKind.EFFECT && observer.notify) {
          observer.notify();
        }
        queue.push(observer);
      }
    }
  }
}

// ---- Pull Phase: Lazy Evaluation (Iterative) ----
// Converted from recursive to iterative using explicit stack to prevent stack
// overflow on deep reactive chains (TC-2). The TC39 Signal proposal uses recursive
// consumerPollSources; our iterative approach avoids V8's ~10,400 frame limit.
// See: https://github.com/tc39/proposal-signals

/**
 * Ensures the node's value is up-to-date by pulling from sources if necessary.
 * Uses an explicit stack to avoid stack overflow on deep computed chains.
 */
export function updateIfNecessary(node: ReactiveNode): void {
  if (node.state === ReactiveState.CLEAN) return;

  const stack: { node: ReactiveNode; sourceIdx: number }[] = [{ node, sourceIdx: 0 }];

  outer:
  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    const n = frame.node;

    if (n.state === ReactiveState.CLEAN) {
      stack.pop();
      continue;
    }

    if (n.state === ReactiveState.CHECK) {
      // Verify sources one at a time, pushing non-CLEAN sources for processing first
      while (frame.sourceIdx < n.sources.length) {
        const source = n.sources[frame.sourceIdx];
        if (source.state !== ReactiveState.CLEAN) {
          stack.push({ node: source, sourceIdx: 0 });
          continue outer;
        }
        if (source.version !== n.sourcesVersions[frame.sourceIdx]) {
          n.state = ReactiveState.DIRTY;
          break;
        }
        frame.sourceIdx++;
      }

      if (n.state === ReactiveState.CHECK) {
        n.state = ReactiveState.CLEAN;
        stack.pop();
        continue;
      }
    }

    // DIRTY — recompute for computed nodes
    if (n.kind === NodeKind.COMPUTED && n.compute) {
      n.compute();
    }
    stack.pop();
  }
}

// ---- Dependency Cleanup ----

/** Remove this node from all its sources' observer lists */
export function cleanupSources(node: ReactiveNode): void {
  for (const source of node.sources) {
    // Use Set for O(1) existence check, then swap-and-pop for O(1) array removal
    const observersSet = source._observersSet;
    if (observersSet) {
      observersSet.delete(node);
    }
    const idx = source.observers.indexOf(node);
    if (idx !== -1) {
      const last = source.observers.length - 1;
      if (idx !== last) {
        source.observers[idx] = source.observers[last];
      }
      source.observers.pop();
    }
  }
  node.sources = [];
  node.sourcesVersions = [];
  node._sourcesSet = undefined;
}

/**
 * Snapshot current source versions after recomputation.
 * Pre-allocates array with known length instead of .map() to reduce allocation (P3).
 */
export function snapshotSourceVersions(node: ReactiveNode): void {
  const sources = node.sources;
  const len = sources.length;
  const versions = new Array<number>(len);
  for (let i = 0; i < len; i++) {
    versions[i] = sources[i].version;
  }
  node.sourcesVersions = versions;
}

/** Safely increment node version with overflow protection (P3). */
export function incrementVersion(node: ReactiveNode): void {
  node.version = (node.version + 1) | 0;
}
