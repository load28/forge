/**
 * JSX Dev Runtime — used by Vite/esbuild in development mode.
 * In dev mode, the compiler imports jsxDEV instead of jsx/jsxs.
 */
import { jsx, Fragment } from './jsx-runtime';

export { Fragment };

export function jsxDEV(
  type: string | Function | symbol,
  props: Record<string, unknown> | null,
  key?: string | number,
) {
  return jsx(type, props, key);
}
