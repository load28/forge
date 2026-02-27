/**
 * JSX Dev Runtime — used by Vite/esbuild in development mode.
 */
import { h, Fragment } from './factory';

export { Fragment };

export function jsxDEV(
  type: string | Function | symbol,
  props: Record<string, unknown> | null,
  key?: string | number,
): unknown {
  if (!props) return h(type, null);

  const { children, ...rest } = props;
  if (key !== undefined) rest.key = key;

  const cleanProps = Object.keys(rest).length > 0 ? rest : null;

  if (children == null) return h(type, cleanProps);
  if (!Array.isArray(children)) return h(type, cleanProps, children);
  return h(type, cleanProps, ...children);
}
