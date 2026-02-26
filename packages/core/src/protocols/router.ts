import type { Disposable } from '../types';

export interface Router<RouteMatch = unknown> {
  current(): RouteMatch;
  onChange(callback: (match: RouteMatch) => void): Disposable;
  go(destination: unknown): void;
  register(definition: unknown): Disposable;
}
