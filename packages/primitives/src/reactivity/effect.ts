import {
  type ReactiveNode,
  ReactiveState,
  NodeKind,
  startTracking,
  endTracking,
  updateIfNecessary,
  cleanupSources,
  snapshotSourceVersions,
} from './reactive-node';

export type EffectScheduler = (run: () => void) => void;

export interface EffectHandle {
  dispose(): void;
}

const defaultScheduler: EffectScheduler = (run) => run();

export function createEffect(
  fn: () => void | (() => void),
  scheduler?: EffectScheduler,
): EffectHandle {
  let disposed = false;
  let cleanup: (() => void) | undefined;
  const schedule = scheduler ?? defaultScheduler;

  const node: ReactiveNode = {
    kind: NodeKind.EFFECT,
    state: ReactiveState.DIRTY, // Initially dirty to force first execution
    version: 0,
    sources: [],
    sourcesVersions: [],
    observers: [], // Effects are leaves — no observers
    notify: () => {
      if (!disposed) {
        schedule(execute);
      }
    },
  };

  function execute(): void {
    if (disposed) return;
    // TC-4: Re-entrance guard — if an effect triggers itself (e.g., by writing
    // to a signal it reads), skip re-execution to prevent infinite loops.
    if (node._computing) return;

    // Pull phase: verify if we actually need to re-run.
    updateIfNecessary(node);
    if (node.state === ReactiveState.CLEAN) return;

    // DIRTY — re-execute the effect
    cleanup?.();

    cleanupSources(node);

    node._computing = true;
    startTracking(node);
    try {
      const result = fn();
      if (typeof result === 'function') {
        cleanup = result;
      } else {
        cleanup = undefined;
      }
    } finally {
      endTracking(node);
      node._computing = false;
    }

    snapshotSourceVersions(node);
    node.state = ReactiveState.CLEAN;
  }

  // First execution is immediate (synchronous)
  execute();

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      cleanup?.();
      cleanup = undefined;
      cleanupSources(node);
    },
  };
}
