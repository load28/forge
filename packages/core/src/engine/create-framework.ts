import type { ReactiveSystem } from '../protocols/reactive';
import type { Renderer } from '../protocols/renderer';
import type { Router } from '../protocols/router';
import type { ComponentSystem } from '../protocols/component';
import type { Scheduler } from '../protocols/scheduler';
import type { MountHandle } from '../types';

export interface FrameworkConfig {
  reactive: ReactiveSystem;
  renderer: Renderer;
  component: ComponentSystem;
  router?: Router;
  scheduler?: Scheduler;
}

export interface Framework {
  reactive: ReactiveSystem;
  renderer: Renderer;
  component: ComponentSystem;
  router?: Router;
  scheduler?: Scheduler;
  mount(container: Element, componentDef: unknown, props?: Record<string, unknown>): MountHandle;
  unmount(handle: MountHandle): void;
}

export function createFramework(config: FrameworkConfig): Framework {
  if (!config.reactive) throw new Error('Forge: reactive system is required');
  if (!config.renderer) throw new Error('Forge: renderer is required');
  if (!config.component) throw new Error('Forge: component system is required');

  const { reactive, renderer, component, router, scheduler } = config;

  function mount(
    container: Element,
    componentDef: unknown,
    props: Record<string, unknown> = {},
  ): MountHandle {
    const handle = component.define(componentDef);
    const view = renderer.createView(handle, props);
    const mountHandle = renderer.mount(view, container);

    reactive.autorun(() => {
      renderer.update(mountHandle);
    });

    if (router) {
      router.onChange(() => {
        renderer.update(mountHandle);
      });
    }

    return mountHandle;
  }

  function unmount(handle: MountHandle): void {
    renderer.unmount(handle);
  }

  return {
    reactive,
    renderer,
    component,
    router,
    scheduler,
    mount,
    unmount,
  };
}
