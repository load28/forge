export interface Disposable {
  dispose(): void;
}

export type Cleanup = () => void;

export interface ComponentHandle {
  readonly _brand: unique symbol;
}

export interface MountHandle {
  readonly container: Element;
}

export interface TaskHandle {
  readonly _brand: unique symbol;
}

export type Props = Record<string, unknown>;

/** Handle for a dynamically rendered component view — delegates to Renderer primitives. */
export interface ViewHandle {
  /** Replace with a different component — delegates to Renderer.replace(). */
  replace(componentDef: unknown, props?: Props): void;
  /** Destroy the view — delegates to Renderer.unmount(). */
  destroy(): void;
}

/** ProseMirror-style plugin view lifecycle — returned by FrameworkPlugin.view(). */
export interface PluginView {
  destroy?(): void;
}

export interface ContextKey<T> {
  readonly _brand: unique symbol;
  readonly _type?: T;
}

export function createContextKey<T>(name: string): ContextKey<T> {
  return { _brand: Symbol(name) } as ContextKey<T>;
}
