import type { Router, Disposable } from '@forge/core';
import { createHashListener, compilePath, matchCompiled, type CompiledRoute } from '@forge/primitives';

interface RouteDefinition {
  path: string;
  name?: string;
}

/** Internal entry pairing a route definition with its pre-compiled regex. */
interface CompiledRouteEntry {
  def: RouteDefinition;
  compiled: CompiledRoute;
}

export interface HashRouteMatch {
  matched: boolean;
  route?: RouteDefinition;
  params: Record<string, string>;
  path: string;
}

/**
 * DX-2: Navigation guard callback.
 * Return `false` to cancel the navigation, or a string to redirect.
 *
 * Based on Vue Router's navigation guards pattern:
 * See: https://router.vuejs.org/guide/advanced/navigation-guards.html
 */
export type NavigationGuard = (
  to: HashRouteMatch,
  from: HashRouteMatch,
) => boolean | string | void;

export interface HashRouter extends Router<HashRouteMatch> {
  destroy(): void;
  /** DX-2: Register a navigation guard that runs before each route change */
  beforeEach(guard: NavigationGuard): Disposable;
}

export function hashRouter(): HashRouter {
  const listener = createHashListener();
  const routes: CompiledRouteEntry[] = [];
  const callbacks = new Set<(match: HashRouteMatch) => void>();
  const guards: NavigationGuard[] = [];
  let lastMatch: HashRouteMatch = { matched: false, params: {}, path: '' };

  function resolve(path: string): HashRouteMatch {
    for (const entry of routes) {
      const result = matchCompiled(entry.compiled, path);
      if (result.matched) {
        return { matched: true, route: entry.def, params: result.params ?? {}, path };
      }
    }
    return { matched: false, params: {}, path };
  }

  /** DX-2: Run all navigation guards. Returns final destination or null to cancel. */
  function runGuards(to: HashRouteMatch, from: HashRouteMatch): HashRouteMatch | null {
    for (const guard of guards) {
      const result = guard(to, from);
      if (result === false) return null; // Cancel navigation
      if (typeof result === 'string') {
        // Redirect — resolve the new path
        return resolve(result);
      }
    }
    return to;
  }

  let redirectDepth = 0;
  const MAX_REDIRECTS = 10;

  listener.onChange((path) => {
    const to = resolve(path);
    const finalMatch = runGuards(to, lastMatch);

    // P3: Guard cancellation — revert URL to previous path
    if (finalMatch === null) {
      if (lastMatch.path) {
        listener.setPath(lastMatch.path);
      }
      return;
    }

    // P3: Redirect detection — sync URL to final destination
    if (finalMatch.path !== to.path) {
      if (++redirectDepth > MAX_REDIRECTS) {
        console.error('Forge: maximum redirect depth exceeded');
        redirectDepth = 0;
        return;
      }
      listener.setPath(finalMatch.path);
      return; // setPath triggers hashchange → re-enters with correct path
    }

    redirectDepth = 0;
    lastMatch = finalMatch;
    const snapshot = [...callbacks];
    for (const cb of snapshot) cb(finalMatch);
  });

  return {
    current() {
      const match = resolve(listener.getPath());
      lastMatch = match;
      return match;
    },
    onChange(callback) {
      callbacks.add(callback);
      return { dispose: () => { callbacks.delete(callback); } };
    },
    go(destination) {
      listener.setPath(destination as string);
    },
    register(definition) {
      const def = definition as RouteDefinition;
      const entry: CompiledRouteEntry = { def, compiled: compilePath(def.path) };
      routes.push(entry);
      return { dispose: () => {
        const idx = routes.indexOf(entry);
        if (idx >= 0) routes.splice(idx, 1);
      }};
    },
    destroy() {
      listener.destroy();
      callbacks.clear();
      routes.length = 0;
      guards.length = 0;
    },
    beforeEach(guard: NavigationGuard): Disposable {
      guards.push(guard);
      return {
        dispose: () => {
          const idx = guards.indexOf(guard);
          if (idx >= 0) guards.splice(idx, 1);
        },
      };
    },
  };
}
