import type { ComponentHandle, Props, ContextKey, Cleanup } from '../types';

export interface ComponentSystem<Definition = unknown, Instance = unknown> {
  define(definition: Definition): ComponentHandle;
  instantiate(handle: ComponentHandle, props: Props): Instance;
  destroy(instance: Instance): void;
  provide<T>(key: ContextKey<T>, value: T): void;
  inject<T>(key: ContextKey<T>, fallback?: T): T;
  onAttach(hook: Cleanup | (() => Cleanup)): void;
  onDetach(hook: () => void): void;
}
