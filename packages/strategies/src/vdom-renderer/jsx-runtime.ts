/**
 * JSX Automatic Runtime for Forge's vdom rendering strategy.
 *
 * Used by TypeScript/esbuild when `tsconfig.json` has:
 *   "jsx": "react-jsx",
 *   "jsxImportSource": "@forge/strategies"
 *
 * The compiler auto-imports jsx/jsxs from this module:
 *   <div class="app">hello</div>
 *   → jsx("div", { class: "app", children: "hello" })
 *
 * See: https://www.typescriptlang.org/tsconfig/#jsxImportSource
 */
import { createVNode, Fragment, type VNode, type VNodeChild } from '@forge/primitives';

export { Fragment };

export function jsx(
  type: string | Function | symbol,
  props: Record<string, unknown> | null,
  key?: string | number,
): VNode {
  if (!props) return createVNode(type, null);

  const { children, ...rest } = props;
  if (key !== undefined) rest.key = key;

  const cleanProps = Object.keys(rest).length > 0 ? rest : null;

  if (children == null) return createVNode(type, cleanProps);
  if (!Array.isArray(children)) return createVNode(type, cleanProps, children as VNodeChild);
  return createVNode(type, cleanProps, ...(children as VNodeChild[]));
}

export function jsxs(
  type: string | Function | symbol,
  props: Record<string, unknown> | null,
  key?: string | number,
): VNode {
  return jsx(type, props, key);
}

// JSX type declarations
declare global {
  namespace JSX {
    type Element = VNode;
    interface IntrinsicElements {
      [tag: string]: Record<string, unknown>;
    }
  }
}
