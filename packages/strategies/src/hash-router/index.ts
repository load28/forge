import type { Router, Disposable } from '@forge/core';
import { createHashListener, matchPath } from '@forge/primitives';

interface RouteDefinition {
  path: string;
  name?: string;
}

export interface HashRouteMatch {
  matched: boolean;
  route?: RouteDefinition;
  params: Record<string, string>;
  path: string;
}

export interface HashRouter extends Router<HashRouteMatch> {
  destroy(): void;
}

export function hashRouter(): HashRouter {
  const listener = createHashListener();
  const routes: RouteDefinition[] = [];
  const callbacks = new Set<(match: HashRouteMatch) => void>();

  function resolve(path: string): HashRouteMatch {
    for (const route of routes) {
      const result = matchPath(route.path, path);
      if (result.matched) {
        return { matched: true, route, params: result.params ?? {}, path };
      }
    }
    return { matched: false, params: {}, path };
  }

  listener.onChange((path) => {
    const match = resolve(path);
    for (const cb of callbacks) cb(match);
  });

  return {
    current() {
      return resolve(listener.getPath());
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
      routes.push(def);
      return { dispose: () => {
        const idx = routes.indexOf(def);
        if (idx >= 0) routes.splice(idx, 1);
      }};
    },
    destroy() {
      listener.destroy();
      callbacks.clear();
    },
  };
}
