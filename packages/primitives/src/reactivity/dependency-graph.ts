import type { Signal } from './signal';

interface Disposable {
  dispose(): void;
}

type Effect = {
  fn: () => void | (() => void);
  deps: Set<Signal<any>>;
  unsubs: (() => void)[];
  cleanup?: () => void;
};

export class DependencyGraph {
  private currentEffect: Effect | null = null;

  track(signal: Signal<any>): void {
    if (this.currentEffect) {
      this.currentEffect.deps.add(signal);
    }
  }

  autorun(fn: () => void | (() => void)): Disposable {
    const effect: Effect = { fn, deps: new Set(), unsubs: [], cleanup: undefined };

    const run = () => {
      // cleanup previous
      effect.cleanup?.();
      effect.unsubs.forEach(u => u());
      effect.unsubs = [];
      effect.deps.clear();

      // track new deps
      this.currentEffect = effect;
      try {
        const result = effect.fn();
        if (typeof result === 'function') {
          effect.cleanup = result;
        }
      } finally {
        this.currentEffect = null;
      }

      // subscribe to tracked deps
      for (const dep of effect.deps) {
        effect.unsubs.push(dep.subscribe(() => run()));
      }
    };

    run();

    return {
      dispose() {
        effect.cleanup?.();
        effect.unsubs.forEach(u => u());
        effect.unsubs = [];
        effect.deps.clear();
      },
    };
  }
}
