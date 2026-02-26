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

/**
 * A-FC-1: Tree-scoped context node — forms a prototype chain for context lookup.
 * Each component instantiation creates a new ContextScope that inherits from its parent.
 * inject() walks up the chain via Object.getPrototypeOf until a key is found.
 *
 * This follows React's Context pattern where "React searches the component tree
 * to find the closest context provider" (https://react.dev/reference/react/useContext)
 * and SolidJS's Context which "provides dependency injection to avoid prop drilling"
 * (https://docs.solidjs.com/concepts/context).
 */
interface ContextScope {
  values: Map<symbol, unknown>;
  parent: ContextScope | null;
}

export function functionComponent(): FnComponentSystem {
  // A-FC-1: Root scope — shared across all top-level components
  const rootScope: ContextScope = { values: new Map(), parent: null };

  // A-XC-1: Instance-scoped state — each functionComponent() call creates isolated state.
  // The scope stack tracks the current component's context scope during instantiation,
  // enabling tree-scoped provide/inject without module-level mutable singletons.
  let currentScope: ContextScope = rootScope;

  // BUG-15 fix: Use a proper stack for hook registration context.
  // Previous implementation used module-level variables that would be corrupted
  // if component instantiation was nested (e.g., parent factory calling child factory).
  // Now we save/restore the hook context on a stack, similar to React's dispatcher pattern.
  interface HookContext {
    attachHooks: { hook: Cleanup | (() => Cleanup) }[];
    detachHooks: (() => void)[];
    scope: ContextScope;
  }

  const hookContextStack: HookContext[] = [];
  let currentHookContext: HookContext | null = null;

  function pushHookContext(): HookContext {
    // A-FC-1: Each instantiation gets a child scope inheriting from current scope
    const childScope: ContextScope = { values: new Map(), parent: currentScope };
    const ctx: HookContext = { attachHooks: [], detachHooks: [], scope: childScope };
    if (currentHookContext) {
      hookContextStack.push(currentHookContext);
    }
    currentHookContext = ctx;
    currentScope = childScope;
    return ctx;
  }

  function popHookContext(): void {
    const prev = hookContextStack.pop() ?? null;
    currentHookContext = prev;
    currentScope = prev ? prev.scope : rootScope;
  }

  function define(definition: RenderFn): FnComponentHandle {
    return { _brand: Symbol('component') as any, factory: definition };
  }

  function instantiate(handle: ComponentHandle, props: Props): FnComponentInstance {
    const h = handle as FnComponentHandle;

    // Push a new hook context — nested instantiate() calls won't corrupt the parent's hooks
    const ctx = pushHookContext();
    try {
      const render = h.factory(props);

      const { attachHooks, detachHooks } = ctx;
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
    } finally {
      // Always restore parent hook context, even if factory throws
      popHookContext();
    }
  }

  function destroy(instance: FnComponentInstance): void {
    instance.detach();
  }

  /**
   * A-FC-1: Provide a value into the current component's context scope.
   * Values provided here are visible to this component and all descendants,
   * but NOT to siblings or ancestors — matching React's Provider nesting pattern.
   */
  function provide<T>(key: ContextKey<T>, value: T): void {
    currentScope.values.set(key._brand, value);
  }

  /**
   * A-FC-1: Inject a value by walking up the scope chain.
   * Finds the closest ancestor that provided a value for this key.
   * Falls back to the fallback value if no provider is found.
   */
  function inject<T>(key: ContextKey<T>, fallback?: T): T {
    let scope: ContextScope | null = currentScope;
    while (scope !== null) {
      if (scope.values.has(key._brand)) {
        return scope.values.get(key._brand) as T;
      }
      scope = scope.parent;
    }
    if (fallback !== undefined) return fallback;
    throw new Error('Context not found for key');
  }

  function onAttach(hook: Cleanup | (() => Cleanup)): void {
    if (!currentHookContext) {
      throw new Error('onAttach must be called during component instantiation');
    }
    currentHookContext.attachHooks.push({ hook });
  }

  function onDetach(hook: () => void): void {
    if (!currentHookContext) {
      throw new Error('onDetach must be called during component instantiation');
    }
    currentHookContext.detachHooks.push(hook);
  }

  return { define, instantiate, destroy, provide, inject, onAttach, onDetach };
}
