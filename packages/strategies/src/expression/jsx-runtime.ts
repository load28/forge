/**
 * JSX Automatic Runtime for Forge.
 *
 * IR-agnostic: delegates to h() which calls whatever factory the active
 * rendering strategy registered. Does not import VNode or any specific IR.
 *
 * Used by TypeScript/esbuild when tsconfig.json has:
 *   "jsx": "react-jsx",
 *   "jsxImportSource": "@forge/strategies"
 *
 * See: https://www.typescriptlang.org/tsconfig/#jsxImportSource
 */
import { h, Fragment } from './factory';

export { Fragment };

export function jsx(
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

export function jsxs(
  type: string | Function | symbol,
  props: Record<string, unknown> | null,
  key?: string | number,
): unknown {
  return jsx(type, props, key);
}

// JSX type declarations — generic, not tied to any IR
declare global {
  namespace JSX {
    type Element = unknown;
    interface IntrinsicElements {
      [tag: string]: Record<string, unknown>;
    }
  }
}
