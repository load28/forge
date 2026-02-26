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

export interface ContextKey<T> {
  readonly _brand: unique symbol;
  readonly _type?: T;
}

export function createContextKey<T>(name: string): ContextKey<T> {
  return { _brand: Symbol(name) } as ContextKey<T>;
}
