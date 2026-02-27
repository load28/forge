import type { ReactiveSystem } from '../protocols/reactive';
import type { Renderer } from '../protocols/renderer';
import type { Router } from '../protocols/router';
import type { ComponentSystem } from '../protocols/component';
import type { Scheduler } from '../protocols/scheduler';
import type { MountHandle, Disposable, ViewHandle, PluginView } from '../types';

export interface FrameworkConfig {
  reactive: ReactiveSystem;
  renderer: Renderer;
  component: ComponentSystem;
  router?: Router;
  scheduler?: Scheduler;
  /** ARCH-1: Plugins that extend the framework with additional functionality */
  plugins?: FrameworkPlugin[];
}

/**
 * ARCH-1: Plugin interface for framework composability.
 *
 * Includes ProseMirror-inspired `view()` lifecycle: when mount() is called,
 * each plugin's `view()` receives the framework and container, returning a
 * PluginView with a `destroy()` hook. Plugins can use `framework.createView()`
 * inside `view()` to render their own components.
 *
 * Based on:
 * - ProseMirror Plugin.view() pattern (https://prosemirror.net/docs/ref/#state.PluginSpec.view)
 * - Express.js middleware (https://expressjs.com/en/guide/using-middleware.html)
 * - Vue 3 app.use() (https://vuejs.org/guide/reusability/plugins.html)
 */
export interface FrameworkPlugin {
  name: string;
  /** Called when the framework is created. Can modify config or add state. */
  install?(framework: Framework): void;
  /**
   * ProseMirror-style view lifecycle — called during mount().
   * Receives the framework (rendering API) and the container.
   * Returns a PluginView with destroy() for cleanup on unmount.
   */
  view?(framework: Framework, container: Element): PluginView;
  /** Called before mount — can transform props or container */
  beforeMount?(container: Element, componentDef: unknown, props: Record<string, unknown>): void;
  /** Called after mount — receives the mount handle */
  afterMount?(handle: MountHandle): void;
  /** Called before unmount */
  beforeUnmount?(handle: MountHandle): void;
}

export interface Framework {
  reactive: ReactiveSystem;
  renderer: Renderer;
  component: ComponentSystem;
  router?: Router;
  scheduler?: Scheduler;
  mount(container: Element, componentDef?: unknown, props?: Record<string, unknown>): MountHandle;
  unmount(handle: MountHandle): void;
  /** ARCH-1: Register a plugin at runtime */
  use(plugin: FrameworkPlugin): Framework;
  /**
   * Component rendering API — delegates entirely to injected Renderer primitives.
   * Returns a ViewHandle with replace() and destroy().
   * Wraps rendering in reactive.autorun() for signal tracking.
   */
  createView(container: Element, componentDef: unknown, props?: Record<string, unknown>): ViewHandle;
}

/** Internal metadata for mount handles — stored externally via WeakMap (P11 fix) */
interface MountMetadata {
  disposables: Disposable[];
  pluginViews: PluginView[];
  instance: unknown;
}

export function createFramework(config: FrameworkConfig): Framework {
  if (!config.reactive) throw new Error('Forge: reactive system is required');
  if (!config.renderer) throw new Error('Forge: renderer is required');
  if (!config.component) throw new Error('Forge: component system is required');

  const { reactive, renderer, component, router, scheduler } = config;
  const plugins: FrameworkPlugin[] = [];

  // P11 fix: Use WeakMap instead of type-casting MountHandle with internal fields
  const mountData = new WeakMap<MountHandle, MountMetadata>();

  // --- Component rendering API ---

  function createView(
    container: Element,
    componentDef: unknown,
    props: Record<string, unknown> = {},
  ): ViewHandle {
    const compHandle = component.define(componentDef);
    // P2: Instantiate component for lifecycle hooks and context
    let instance: unknown = null;
    if (component.instantiate) {
      instance = component.instantiate(compHandle, props);
    }
    const view = renderer.createView(compHandle, props);

    let mountHandle: MountHandle | null = null;
    let currentDisposable: Disposable | null = null;

    // Initial mount inside autorun for reactive tracking
    currentDisposable = reactive.autorun(() => {
      if (!mountHandle) {
        mountHandle = renderer.mount(view, container);
      } else {
        renderer.update(mountHandle);
      }
    });

    // P2: Trigger onAttach lifecycle after mount
    attachLifecycle(instance);

    return {
      replace(newComponentDef, newProps = {}) {
        // Dispose old reactive tracking
        currentDisposable?.dispose();
        // P2: Destroy old component instance
        if (instance && component.destroy) {
          component.destroy(instance);
        }
        // Delegate to Renderer primitives
        const newCompHandle = component.define(newComponentDef);
        // P2: Instantiate new component
        instance = null;
        if (component.instantiate) {
          instance = component.instantiate(newCompHandle, newProps);
        }
        const newView = renderer.createView(newCompHandle, newProps);
        mountHandle = renderer.replace(mountHandle!, newView);
        // Re-establish reactive tracking for new component's signals
        currentDisposable = reactive.autorun(() => {
          renderer.update(mountHandle!);
        });
        // P2: Trigger onAttach for new component
        attachLifecycle(instance);
      },
      destroy() {
        currentDisposable?.dispose();
        // P2: Destroy component instance (triggers onDetach hooks)
        if (instance && component.destroy) {
          component.destroy(instance);
        }
        if (mountHandle) renderer.unmount(mountHandle);
      },
    };
  }

  // --- Mount sub-steps ---

  function runPluginBeforeMount(container: Element, componentDef: unknown, props: Record<string, unknown>): void {
    for (const p of plugins) {
      p.beforeMount?.(container, componentDef, props);
    }
  }

  function createComponentInstance(componentDef: unknown, props: Record<string, unknown>): { handle: ReturnType<ComponentSystem['define']>; instance: unknown } {
    const handle = component.define(componentDef);
    let instance: unknown = null;
    if (component.instantiate) {
      instance = component.instantiate(handle, props);
    }
    return { handle, instance };
  }

  function mountWithReactiveTracking(view: unknown, container: Element): { mountHandle: MountHandle; dispose: () => void; retrack: () => void } {
    let mountHandle: MountHandle | null = null;
    let currentDisposable: Disposable | null = null;

    function createAutorun(): void {
      currentDisposable = reactive.autorun(() => {
        if (!mountHandle) {
          mountHandle = renderer.mount(view, container);
        } else {
          renderer.update(mountHandle);
        }
      });
    }

    // TC-1 fix: Perform initial mount INSIDE autorun to avoid double render.
    createAutorun();

    // autorun is synchronous — mountHandle is guaranteed to be set here
    if (!mountHandle) {
      throw new Error('Forge: mount failed — reactive.autorun did not execute synchronously');
    }

    return {
      mountHandle,
      dispose() { currentDisposable?.dispose(); },
      retrack() {
        currentDisposable?.dispose();
        createAutorun();
      },
    };
  }

  function attachLifecycle(instance: unknown): void {
    if (instance && typeof (instance as { attach?: () => void }).attach === 'function') {
      (instance as { attach: () => void }).attach();
    }
  }

  function bindRouter(retrack: () => void): Disposable | null {
    if (!router) return null;
    return router.onChange(() => {
      retrack();
    });
  }

  function runPluginViews(container: Element): PluginView[] {
    const views: PluginView[] = [];
    for (const p of plugins) {
      if (p.view) {
        const pv = p.view(framework, container);
        if (pv) views.push(pv);
      }
    }
    return views;
  }

  function runPluginAfterMount(mountHandle: MountHandle): void {
    for (const p of plugins) {
      p.afterMount?.(mountHandle);
    }
  }

  // --- Main mount/unmount ---

  function mount(
    container: Element,
    componentDef?: unknown,
    props: Record<string, unknown> = {},
  ): MountHandle {
    runPluginBeforeMount(container, componentDef, props);

    const disposables: Disposable[] = [];
    let mountHandle: MountHandle;
    let instance: unknown = null;

    if (componentDef) {
      // Component-driven mount (existing behavior)
      const comp = createComponentInstance(componentDef, props);
      instance = comp.instance;
      const view = renderer.createView(comp.handle, props);

      const tracked = mountWithReactiveTracking(view, container);
      mountHandle = tracked.mountHandle;
      disposables.push({ dispose: tracked.dispose });

      attachLifecycle(instance);

      const routerDisposable = bindRouter(tracked.retrack);
      if (routerDisposable) disposables.push(routerDisposable);
    } else {
      // Plugin-driven mount — no component, plugins handle rendering via view()
      mountHandle = { container } as MountHandle;
    }

    // ProseMirror-style: call plugin view() hooks
    const pluginViews = runPluginViews(container);

    mountData.set(mountHandle, { disposables, pluginViews, instance });

    runPluginAfterMount(mountHandle);

    return mountHandle;
  }

  function unmount(handle: MountHandle): void {
    // ARCH-1: Run plugin beforeUnmount hooks
    for (const p of plugins) {
      p.beforeUnmount?.(handle);
    }

    const meta = mountData.get(handle);
    if (meta) {
      // Destroy plugin views first
      for (const pv of meta.pluginViews) {
        pv.destroy?.();
      }
      // Clean up subscriptions to prevent updates during unmount (BUG-9)
      for (const d of meta.disposables) {
        d.dispose();
      }
      // TC-6: Call component.destroy() to run detach hooks and cleanup
      if (meta.instance && component.destroy) {
        component.destroy(meta.instance);
      }
      mountData.delete(handle);
    }

    renderer.unmount(handle);
  }

  /** ARCH-1: Register a plugin and call its install hook */
  function use(plugin: FrameworkPlugin): Framework {
    // P7: Guard against duplicate plugin registration
    if (plugins.some(p => p.name === plugin.name)) {
      console.warn(`Forge: plugin "${plugin.name}" is already registered, skipping.`);
      return framework;
    }
    plugins.push(plugin);
    plugin.install?.(framework);
    return framework;
  }

  const framework: Framework = {
    reactive,
    renderer,
    component,
    router,
    scheduler,
    mount,
    unmount,
    use,
    createView,
  };

  // Install initial plugins from config
  if (config.plugins) {
    for (const p of config.plugins) {
      use(p);
    }
  }

  return framework;
}
