import type { ComponentSystem, ComponentHandle, Props, ContextKey, Cleanup } from '@forge/core';

type RenderFn = (props: Props) => () => unknown;

interface FnComponentInstance {
  render: () => unknown;
  attach(): void;
  detach(): void;
}

interface FnComponentHandle extends ComponentHandle {
  factory: RenderFn;
}

export interface FnComponentSystem extends ComponentSystem<RenderFn, FnComponentInstance> {
  instantiate(handle: ComponentHandle, props: Props): FnComponentInstance;
}

export function functionComponent(): FnComponentSystem {
  const contextMap = new Map<symbol, unknown>();
  let currentAttachHooks: { hook: Cleanup | (() => Cleanup) }[] = [];
  let currentDetachHooks: (() => void)[] = [];

  function define(definition: RenderFn): FnComponentHandle {
    return { _brand: Symbol('component') as any, factory: definition };
  }

  function instantiate(handle: ComponentHandle, props: Props): FnComponentInstance {
    const h = handle as FnComponentHandle;

    const attachHooks: { hook: Cleanup | (() => Cleanup) }[] = [];
    const detachHooks: (() => void)[] = [];
    currentAttachHooks = attachHooks;
    currentDetachHooks = detachHooks;

    const render = h.factory(props);

    currentAttachHooks = [];
    currentDetachHooks = [];

    let cleanups: Cleanup[] = [];

    return {
      render,
      attach() {
        for (const { hook } of attachHooks) {
          const result = typeof hook === 'function' ? (hook as () => Cleanup | void)() : undefined;
          if (typeof result === 'function') cleanups.push(result);
        }
      },
      detach() {
        for (const cleanup of cleanups) cleanup();
        cleanups = [];
        for (const hook of detachHooks) hook();
      },
    };
  }

  function destroy(instance: FnComponentInstance): void {
    instance.detach();
  }

  function provide<T>(key: ContextKey<T>, value: T): void {
    contextMap.set(key._brand, value);
  }

  function inject<T>(key: ContextKey<T>, fallback?: T): T {
    if (contextMap.has(key._brand)) return contextMap.get(key._brand) as T;
    if (fallback !== undefined) return fallback;
    throw new Error('Context not found for key');
  }

  function onAttach(hook: Cleanup | (() => Cleanup)): void {
    currentAttachHooks.push({ hook });
  }

  function onDetach(hook: () => void): void {
    currentDetachHooks.push(hook);
  }

  return { define, instantiate, destroy, provide, inject, onAttach, onDetach };
}
