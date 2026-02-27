/**
 * Expression factory — generic IR-agnostic expression layer.
 *
 * The factory is injected by the active rendering strategy (e.g., vdomRenderer
 * registers createVNode). This decouples expression syntax (h, JSX) from
 * the concrete IR (VNode, DOM, string, etc.).
 *
 * Timing: registerFactory() must be called before any render function executes.
 * This is guaranteed because component render functions are lazy (() => JSX).
 */

type ExpressionFactory = (
  tag: string | Function | symbol,
  props: Record<string, unknown> | null,
  ...children: unknown[]
) => unknown;

let _factory: ExpressionFactory | null = null;

/**
 * Fragment symbol — renders children without a wrapper element.
 * This is a universal UI concept shared across all rendering strategies.
 */
export const Fragment = Symbol.for('forge.fragment');

/**
 * Register the concrete factory that h() delegates to.
 * Called by the rendering strategy during initialization.
 */
export function registerFactory(factory: ExpressionFactory): void {
  _factory = factory;
}

/**
 * Create a view element. Delegates to the registered factory.
 *
 * @example
 * ```ts
 * import { h } from '@forge/strategies';
 * const el = h('div', { class: 'app' }, h('span', null, 'hello'));
 * ```
 */
export function h(
  tag: string | Function | symbol,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): unknown {
  if (!_factory) {
    throw new Error(
      'Forge: no expression factory registered. ' +
      'Ensure a rendering strategy (e.g., vdomRenderer()) is created before rendering.',
    );
  }
  return _factory(tag, props, ...children);
}
