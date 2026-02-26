import type { FrameworkPlugin, PluginView, Disposable } from '@forge/core';

export interface RouteComponent {
  path: string;
  name?: string;
  component: unknown;
}

/**
 * Router-view plugin — combines the Router API with the Framework's
 * component rendering API to automatically render the matched route's component.
 *
 * This is a pure composition plugin: it owns no rendering logic itself,
 * delegating entirely to framework.createView() (which delegates to Renderer primitives)
 * and framework.router (which handles URL matching).
 *
 * Inspired by ProseMirror's Plugin.view() pattern where plugins use the
 * editor's rendering API to manage their own DOM lifecycle.
 * See: https://prosemirror.net/docs/ref/#state.PluginSpec.view
 */
export function routerView(routes: RouteComponent[]): FrameworkPlugin {
  return {
    name: 'router-view',

    view(framework, container): PluginView {
      if (!framework.router) {
        throw new Error('routerView plugin requires a router to be configured');
      }

      const disposables: Disposable[] = [];

      // 1. Router API — register routes
      for (const r of routes) {
        disposables.push(
          framework.router.register({ path: r.path, name: r.name }),
        );
      }

      // 2. Framework rendering API — mount initial route's component
      const match = framework.router.current() as { path: string };
      const initial = routes.find(r => r.path === match.path) ?? routes[0];
      const viewHandle = framework.createView(container, initial.component);

      // 3. Router API + Rendering API composition
      const routerSub = framework.router.onChange((m: unknown) => {
        const routeMatch = m as { path: string };
        const route = routes.find(r => r.path === routeMatch.path);
        if (route) viewHandle.replace(route.component);
      });
      disposables.push(routerSub);

      return {
        destroy() {
          viewHandle.destroy();
          for (const d of disposables) d.dispose();
        },
      };
    },
  };
}
