/**
 * DX-XC-1: Error boundary support for Forge's DOM rendering.
 *
 * Provides a mechanism to catch errors during rendering and display fallback UI.
 * Based on Vue 3's onErrorCaptured pattern and React's componentDidCatch/ErrorBoundary.
 *
 * Vue 3 onErrorCaptured: https://vuejs.io/api/composition-api-lifecycle#onerrorcaptured
 * React Error Boundaries: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 */
import type { VNode, VNodeChild } from './vnode';
import { h, VNODE_TYPE } from './vnode';

export type ErrorHandler = (error: unknown) => VNode | null;

/**
 * Create an error boundary VNode that catches errors in its children
 * and renders a fallback UI.
 *
 * @example
 * ```ts
 * const tree = errorBoundary(
 *   (error) => h('div', { class: 'error' }, `Error: ${error}`),
 *   h('div', null, riskyContent)
 * );
 * ```
 */
export function errorBoundary(
  fallback: ErrorHandler,
  ...children: VNodeChild[]
): VNode & { _errorHandler: ErrorHandler } {
  const vnode = h('forge-error-boundary', null, ...children) as VNode & { _errorHandler: ErrorHandler };
  vnode._errorHandler = fallback;
  return vnode;
}

/**
 * Try to execute a render function, catching any synchronous errors.
 * Returns the fallback VNode if an error occurs.
 */
export function tryCatchRender(
  renderFn: () => VNode,
  onError: ErrorHandler,
): VNode {
  try {
    return renderFn();
  } catch (error) {
    const fallback = onError(error);
    return fallback ?? h('span', null);
  }
}
