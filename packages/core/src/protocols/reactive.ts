import type { Disposable, Cleanup } from '../types';

export interface ReactiveSystem {
  autorun(fn: () => void | Cleanup): Disposable;
  batch(fn: () => void): void;
}
