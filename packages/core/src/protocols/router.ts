import type { Disposable } from '../types';

/**
 * Router protocol — URL-based navigation with pattern matching.
 *
 * The generic `RouteMatch` parameter allows different match result shapes:
 * - HashRouter: { matched, route, params, path }
 * - HistoryRouter: { matched, route, params, path, search }
 *
 * Usage pattern: call `current()` for the initial state, then `onChange()`
 * for subsequent navigation events.
 */
export interface Router<RouteMatch = unknown> {
  /** Get the current route match result. */
  current(): RouteMatch;

  /** Subscribe to route changes. Returns a disposable to unsubscribe. */
  onChange(callback: (match: RouteMatch) => void): Disposable;

  /** Navigate to a destination (path string or route descriptor). */
  go(destination: unknown): void;

  /** Register a route definition. Returns a disposable to unregister. */
  register(definition: unknown): Disposable;
}
