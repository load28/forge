import type { ComponentHandle, Props, ContextKey, Cleanup } from '../types';

/**
 * ComponentSystem protocol — lifecycle management and dependency injection.
 *
 * Lifecycle: define → instantiate → attach → (re-render) → detach → destroy
 *
 * The `Definition` generic is the user-facing component definition (e.g., a factory function).
 * The `Instance` generic is the framework-internal instance with render + lifecycle hooks.
 *
 * Context (provide/inject) follows React's Context pattern for dependency injection.
 * See: https://react.dev/reference/react/useContext
 */
export interface ComponentSystem<Definition = unknown, Instance = unknown> {
  /** Register a component definition, returning a reusable handle. */
  define(definition: Definition): ComponentHandle;

  /** Create a component instance from a handle + props. Runs the factory function. */
  instantiate(handle: ComponentHandle, props: Props): Instance;

  /** Destroy a component instance — runs detach hooks and cleans up resources. */
  destroy(instance: Instance): void;

  /** Provide a context value accessible to descendant components. */
  provide<T>(key: ContextKey<T>, value: T): void;

  /** Inject a context value from an ancestor, with optional fallback. */
  inject<T>(key: ContextKey<T>, fallback?: T): T;

  /** Register a hook to run when the component is attached to the DOM. */
  onAttach(hook: Cleanup | (() => Cleanup)): void;

  /** Register a hook to run when the component is detached from the DOM. */
  onDetach(hook: () => void): void;
}
