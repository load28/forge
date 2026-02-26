/**
 * Graph-connected signal — convenience helper that creates a Signal pre-wired
 * to a ReactiveNode for automatic dependency tracking in the push-pull graph.
 *
 * Without this, users must manually create a ReactiveNode, wire onRead/onWrite,
 * and manage the node version. This is the recommended way to create signals
 * in the reactive graph (AR-1).
 *
 * Based on Preact Signals' internal signal-to-node wiring pattern.
 * See: https://preactjs.com/blog/signal-boosting/
 */
import { createSignal, type Signal, type SignalOptions } from './signal';
import {
  type ReactiveNode,
  ReactiveState,
  NodeKind,
  reportRead,
  propagateDirty,
  incrementVersion,
} from './reactive-node';

export interface GraphSignal<T> extends Signal<T> {
  /** The underlying reactive graph node for this signal */
  readonly node: ReactiveNode;
}

export function createGraphSignal<T>(
  initial: T,
  options?: Omit<SignalOptions<T>, 'onRead' | 'onWrite'>,
): GraphSignal<T> {
  const node: ReactiveNode = {
    kind: NodeKind.SOURCE,
    state: ReactiveState.CLEAN,
    version: 0,
    sources: [],
    sourcesVersions: [],
    observers: [],
  };

  const signal = createSignal(initial, {
    equals: options?.equals,
    onRead: () => reportRead(node),
    onWrite: () => {
      incrementVersion(node);
      propagateDirty(node);
    },
  });

  return Object.assign(signal, { node }) as GraphSignal<T>;
}
